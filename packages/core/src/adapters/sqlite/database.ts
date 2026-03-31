import { DatabaseSync } from 'node:sqlite'

import { type SQL } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'

import type { OrbitDatabase } from '../interface.js'

const dialect = new SQLiteSyncDialect()

function render(statement: SQL) {
  return dialect.sqlToQuery(statement)
}

export interface SqliteOrbitDatabaseOptions {
  filename?: string
}

export class SqliteOrbitDatabase implements OrbitDatabase {
  readonly client: DatabaseSync
  #transactionDepth = 0

  constructor(options: SqliteOrbitDatabaseOptions = {}) {
    this.client = new DatabaseSync(options.filename ?? ':memory:')
  }

  async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T> {
    const savepoint = `sp_${this.#transactionDepth + 1}`
    const beginSql = this.#transactionDepth === 0 ? 'begin' : `savepoint ${savepoint}`
    const commitSql = this.#transactionDepth === 0 ? 'commit' : `release savepoint ${savepoint}`
    const rollbackSql = this.#transactionDepth === 0 ? 'rollback' : `rollback to savepoint ${savepoint}`

    this.client.exec(beginSql)
    this.#transactionDepth += 1

    try {
      const result = await fn(this)
      this.client.exec(commitSql)
      return result
    } catch (error) {
      this.client.exec(rollbackSql)
      throw error
    } finally {
      this.#transactionDepth -= 1
    }
  }

  async execute(statement: SQL): Promise<unknown> {
    const query = render(statement)
    return this.client.prepare(query.sql).run(...(query.params as any[]))
  }

  async query<T extends Record<string, unknown>>(statement: SQL): Promise<T[]> {
    const query = render(statement)
    return this.client.prepare(query.sql).all(...(query.params as any[])) as T[]
  }
}

export function createSqliteOrbitDatabase(options?: SqliteOrbitDatabaseOptions): SqliteOrbitDatabase {
  return new SqliteOrbitDatabase(options)
}
