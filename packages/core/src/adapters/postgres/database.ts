import { sql, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'

import type { OrbitDatabase } from '../interface.js'

const dialect = new PgDialect()
const ORBIT_SCHEMA = 'orbit'
const ORBIT_SEARCH_PATH = `${ORBIT_SCHEMA}, pg_temp`

function render(statement: SQL) {
  return dialect.sqlToQuery(statement)
}

function buildSetSearchPathStatement() {
  return sql`select set_config('search_path', ${ORBIT_SEARCH_PATH}, true)`
}

async function executeStatement(
  executor: Pick<PostgresClientLike, 'query'>,
  statement: SQL,
): Promise<unknown> {
  const query = render(statement)
  return executor.query(query.sql, query.params as unknown[])
}

export interface PostgresQueryResult<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[]
  rowCount: number | null
}

export interface PostgresClientLike {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresQueryResult<T>>
  release?(): void
}

export interface PostgresPoolLike {
  connect(): Promise<PostgresClientLike>
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresQueryResult<T>>
  end?(): Promise<void>
}

export interface PostgresOrbitDatabaseOptions {
  connectionString?: string
  pool?: PostgresPoolLike
}

interface InternalOptions {
  pool: PostgresPoolLike
  ownsPool: boolean
  session: PostgresClientLike | null
  transactionDepth: number
  currentOrgId: string | null
}

export class PostgresOrbitDatabase implements OrbitDatabase {
  readonly pool: PostgresPoolLike

  private readonly ownsPool: boolean
  private readonly session: PostgresClientLike | null
  private readonly transactionDepth: number
  private currentOrgId: string | null

  private async runWithPinnedSearchPath<T>(fn: (tx: PostgresOrbitDatabase) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()

    try {
      await client.query('begin')
      await executeStatement(client, buildSetSearchPathStatement())
      const tx = new PostgresOrbitDatabase({
        pool: this.pool,
        ownsPool: this.ownsPool,
        session: client,
        transactionDepth: 1,
        currentOrgId: this.currentOrgId,
      })
      const result = await fn(tx)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release?.()
    }
  }

  constructor(options: PostgresOrbitDatabaseOptions)
  constructor(options: InternalOptions)
  constructor(options: PostgresOrbitDatabaseOptions | InternalOptions) {
    if ('session' in options) {
      this.pool = options.pool
      this.ownsPool = options.ownsPool
      this.session = options.session
      this.transactionDepth = options.transactionDepth
      this.currentOrgId = options.currentOrgId
      return
    }

    const pool = options.pool ?? new Pool({ connectionString: options.connectionString })
    this.pool = pool
    this.ownsPool = !options.pool
    this.session = null
    this.transactionDepth = 0
    this.currentOrgId = null
  }

  async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T> {
    if (this.session) {
      const savepoint = `sp_${this.transactionDepth + 1}`
      await this.session.query(`savepoint ${savepoint}`)
      if (this.transactionDepth === 1) {
        await executeStatement(this.session, buildSetSearchPathStatement())
      }
      const tx = new PostgresOrbitDatabase({
        pool: this.pool,
        ownsPool: this.ownsPool,
        session: this.session,
        transactionDepth: this.transactionDepth + 1,
        currentOrgId: this.currentOrgId,
      })

      try {
        const result = await fn(tx)
        await this.session.query(`release savepoint ${savepoint}`)
        return result
      } catch (error) {
        await this.session.query(`rollback to savepoint ${savepoint}`)
        throw error
      }
    }

    return this.runWithPinnedSearchPath(fn)
  }

  async execute(statement: SQL): Promise<unknown> {
    const query = render(statement)

    if (query.sql.startsWith("select set_config('app.current_org_id'")) {
      this.currentOrgId = String(query.params[0] ?? null)
    }

    if (this.session) {
      return this.session.query(query.sql, query.params as unknown[])
    }

    return this.runWithPinnedSearchPath(async (tx) => tx.execute(statement))
  }

  async query<T extends Record<string, unknown>>(statement: SQL): Promise<T[]> {
    const query = render(statement)

    if (query.sql.trim() === "select current_setting('app.current_org_id', true) as current_org_id") {
      return [{ current_org_id: this.currentOrgId }] as unknown as T[]
    }

    if (this.session) {
      const result = await this.session.query<T>(query.sql, query.params as unknown[])
      return result.rows
    }

    return this.runWithPinnedSearchPath(async (tx) => tx.query<T>(statement))
  }

  async close(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.end?.()
    }
  }
}

export function createPostgresOrbitDatabase(
  options: PostgresOrbitDatabaseOptions = {},
): PostgresOrbitDatabase {
  return new PostgresOrbitDatabase(options)
}
