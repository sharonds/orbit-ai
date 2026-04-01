import { type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'

import type { OrbitDatabase } from '../interface.js'

const dialect = new PgDialect()

function render(statement: SQL) {
  return dialect.sqlToQuery(statement)
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
}

export class PostgresOrbitDatabase implements OrbitDatabase {
  readonly pool: PostgresPoolLike

  private readonly ownsPool: boolean
  private readonly session: PostgresClientLike | null
  private readonly transactionDepth: number

  constructor(options: PostgresOrbitDatabaseOptions)
  constructor(options: InternalOptions)
  constructor(options: PostgresOrbitDatabaseOptions | InternalOptions) {
    if ('session' in options) {
      this.pool = options.pool
      this.ownsPool = options.ownsPool
      this.session = options.session
      this.transactionDepth = options.transactionDepth
      return
    }

    const pool = options.pool ?? new Pool({ connectionString: options.connectionString })
    this.pool = pool
    this.ownsPool = !options.pool
    this.session = null
    this.transactionDepth = 0
  }

  async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T> {
    if (this.session) {
      const savepoint = `sp_${this.transactionDepth + 1}`
      await this.session.query(`savepoint ${savepoint}`)
      const tx = new PostgresOrbitDatabase({
        pool: this.pool,
        ownsPool: this.ownsPool,
        session: this.session,
        transactionDepth: this.transactionDepth + 1,
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

    const client = await this.pool.connect()

    try {
      await client.query('begin')
      const tx = new PostgresOrbitDatabase({
        pool: this.pool,
        ownsPool: this.ownsPool,
        session: client,
        transactionDepth: 1,
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

  async execute(statement: SQL): Promise<unknown> {
    const query = render(statement)
    const executor = this.session ?? this.pool
    return executor.query(query.sql, query.params as unknown[])
  }

  async query<T extends Record<string, unknown>>(statement: SQL): Promise<T[]> {
    const query = render(statement)
    const executor = this.session ?? this.pool
    const result = await executor.query<T>(query.sql, query.params as unknown[])
    return result.rows
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
