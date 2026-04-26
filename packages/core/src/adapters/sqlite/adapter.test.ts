import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sql, type SQL } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSqliteOrbitDatabase, type SqliteOrbitDatabase } from './database.js'
import type { OrbitDatabase } from '../interface.js'
import { asMigrationDatabase } from '../interface.js'
import { createSqliteStorageAdapter } from './adapter.js'

describe('SqliteStorageAdapter', () => {
  it('exposes the expected sqlite capability baseline', () => {
    const database = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(database),
      execute: async () => undefined,
      query: async () => [],
    } satisfies OrbitDatabase

    const adapter = createSqliteStorageAdapter({ database })

    expect(adapter.name).toBe('sqlite')
    expect(adapter.dialect).toBe('sqlite')
    expect(adapter.supportsRls).toBe(false)
    expect(adapter.supportsBranching).toBe(false)
    expect(adapter.supportsJsonbIndexes).toBe(false)
  })

  it('keeps runtime and migration handles distinct when configured', async () => {
    const runtimeDatabase = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(runtimeDatabase),
      execute: async () => undefined,
      query: async () => [],
    } satisfies OrbitDatabase
    const migrationDatabase = asMigrationDatabase({
      transaction: async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(runtimeDatabase),
      execute: async () => undefined,
      query: async () => [],
    } satisfies OrbitDatabase)
    const adapter = createSqliteStorageAdapter({
      database: runtimeDatabase,
      migrationDatabase,
    })

    expect(adapter.unsafeRawDatabase).toBe(runtimeDatabase)

    await adapter.runWithMigrationAuthority(async (db) => {
      expect(db).toBe(migrationDatabase)
      return undefined
    })
  })

  const temporarySqliteFiles = new Set<string>()

  afterEach(() => {
    for (const filename of temporarySqliteFiles) {
      rmSync(filename, { force: true })
    }
    temporarySqliteFiles.clear()
  })

  function createTemporarySqliteDatabase(name: string): { database: SqliteOrbitDatabase; filename: string } {
    const filename = join(
      tmpdir(),
      `orbit-sqlite-adapter-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}.db`,
    )
    temporarySqliteFiles.add(filename)

    return {
      database: createSqliteOrbitDatabase({ filename }),
      filename,
    }
  }

  function closeAndRemoveTemporarySqliteDatabase(database: SqliteOrbitDatabase, filename: string): void {
    database.client.close()
    rmSync(filename, { force: true })
    temporarySqliteFiles.delete(filename)
  }

  it('migrate() uses separate runtime/migration sqlite files only as a handle-selection regression sentinel', async () => {
    const runtime = createTemporarySqliteDatabase('runtime')
    const migration = createTemporarySqliteDatabase('migration')

    const runtimeExecute = vi.spyOn(runtime.database, 'execute')
    const migrationExecute = vi.spyOn(migration.database, 'execute')

    try {
      const adapter = createSqliteStorageAdapter({
        database: runtime.database,
        migrationDatabase: asMigrationDatabase(migration.database),
      })

      await adapter.migrate()

      expect(migrationExecute).toHaveBeenCalled()
      expect(runtimeExecute).not.toHaveBeenCalled()
      await expect(
        migration.database.query(sql`select name from sqlite_master where type = 'table' and name = 'schema_migrations'`),
      ).resolves.toHaveLength(1)
      await expect(
        runtime.database.query(sql`select name from sqlite_master where type = 'table' and name = 'schema_migrations'`),
      ).resolves.toHaveLength(0)
    } finally {
      closeAndRemoveTemporarySqliteDatabase(runtime.database, runtime.filename)
      closeAndRemoveTemporarySqliteDatabase(migration.database, migration.filename)

      expect(existsSync(runtime.filename)).toBe(false)
      expect(existsSync(migration.filename)).toBe(false)
    }
  })

  it('migrate() would fail the handle-selection regression sentinel if schema init used unsafeRawDatabase', async () => {
    const runtimeDatabase = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<unknown>) => fn(runtimeDatabase),
      execute: vi.fn(async () => {
        throw new Error('runtime database must not receive migration schema calls')
      }),
      query: async () => [],
    } satisfies OrbitDatabase
    const migrationDatabase = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<unknown>) => fn(migrationDatabase),
      execute: vi.fn(async () => undefined),
      query: async () => [],
    } satisfies OrbitDatabase

    const adapter = createSqliteStorageAdapter({
      database: runtimeDatabase,
      migrationDatabase: asMigrationDatabase(migrationDatabase),
    })

    await expect(adapter.migrate()).resolves.toBeUndefined()
    expect(runtimeDatabase.execute).not.toHaveBeenCalled()
    expect(migrationDatabase.execute).toHaveBeenCalled()
  })

  it('validates org ids before entering sqlite tenant context', async () => {
    const transaction = vi.fn(async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(database))
    const database = {
      transaction,
      execute: async () => undefined,
      query: async () => [],
    } as OrbitDatabase
    const adapter = createSqliteStorageAdapter({ database })

    await expect(adapter.withTenantContext({ orgId: '' }, async () => 'ok')).rejects.toThrow(
      'Expected organization ID with prefix "org_"',
    )
    expect(transaction).not.toHaveBeenCalled()
  })

  it('migrate() with no migration DB configured runs all wave init functions and creates tables', async () => {
    // Track all SQL statements executed by the default migrateImpl.
    const executedStatements: string[] = []
    const database = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<unknown>) => fn(database),
      execute: vi.fn(async (stmt: SQL) => {
        // sql.raw(statement) produces a SQL object whose first queryChunk
        // holds the raw SQL string. Capture it for assertion.
        const raw =
          (stmt as { queryChunks?: Array<{ value: unknown }> })?.queryChunks?.[0]?.value ??
          String(stmt)
        executedStatements.push(String(raw))
        return undefined
      }),
      query: async () => [],
    } as unknown as OrbitDatabase
    const adapter = createSqliteStorageAdapter({ database })

    await adapter.migrate()

    // Verify that core Wave 1 and Wave 2 tables were scheduled for creation.
    // The wave init functions use "create table if not exists <name>", so
    // we check that each expected table name appears at least once.
    const allSql = executedStatements.join('\n')
    for (const tableName of [
      'organizations',
      'contacts',
      'companies',
      'deals',
      'activities', // wave 2 slice A
      'products',   // wave 2 slice B
      'sequences',  // wave 2 slice C
      'tags',       // wave 2 slice D
      'audit_logs', // wave 2 slice E
    ]) {
      expect(allSql).toContain(tableName)
    }
    expect(allSql).toContain('checksum text not null')
    expect(allSql).toContain('adapter text not null')
    expect(allSql).toContain('forward_operations text not null')
    expect(allSql).toContain('reverse_operations text not null')
    expect(allSql).toContain('status text not null')
    expect(allSql).toContain('schema_migrations_target_idx')
  })

  describe('beginTransaction().run', () => {
    it('rejects before entering the transaction when orgId is an empty string', async () => {
      const transaction = vi.fn(async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(database))
      const database = {
        transaction,
        execute: async () => undefined,
        query: async () => [],
      } as OrbitDatabase
      const adapter = createSqliteStorageAdapter({ database })
      const scope = adapter.beginTransaction()

      await expect(scope.run({ orgId: '' }, async () => 'ok')).rejects.toThrow(
        'Expected organization ID with prefix "org_"',
      )
      expect(transaction).not.toHaveBeenCalled()
    })

    it('rejects before entering the transaction when orgId is not a valid ULID', async () => {
      const transaction = vi.fn(async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(database))
      const database = {
        transaction,
        execute: async () => undefined,
        query: async () => [],
      } as OrbitDatabase
      const adapter = createSqliteStorageAdapter({ database })
      const scope = adapter.beginTransaction()

      await expect(scope.run({ orgId: 'not-a-valid-id' }, async () => 'ok')).rejects.toThrow()
      expect(transaction).not.toHaveBeenCalled()
    })

    it('invokes the callback with a transaction-scoped database for a valid orgId', async () => {
      const transaction = vi.fn(async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(database))
      const database = {
        transaction,
        execute: async () => undefined,
        query: async () => [],
      } as OrbitDatabase
      const adapter = createSqliteStorageAdapter({ database })
      const scope = adapter.beginTransaction()

      const result = await scope.run(
        { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' },
        async (txDb) => {
          expect(txDb).toBe(database)
          return 'done'
        },
      )

      expect(result).toBe('done')
      expect(transaction).toHaveBeenCalledTimes(1)
    })
  })

  it('migrate() respects a custom migrate function when provided', async () => {
    const customMigrate = vi.fn(async () => undefined)
    const database = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<unknown>) => fn(database),
      execute: vi.fn(async () => undefined),
      query: async () => [],
    } as unknown as OrbitDatabase
    const adapter = createSqliteStorageAdapter({ database, migrate: customMigrate })

    await adapter.migrate()

    expect(customMigrate).toHaveBeenCalledTimes(1)
    // When a custom migrate is provided, the default schema init should NOT run.
    expect((database.execute as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})
