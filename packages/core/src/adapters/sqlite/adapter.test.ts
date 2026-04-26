import { describe, expect, it, vi } from 'vitest'

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

  it('migrate() with no custom config runs all wave init functions and creates tables', async () => {
    // Track all SQL statements executed by the default migrateImpl.
    const executedStatements: string[] = []
    const database = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<unknown>) => fn(database),
      execute: vi.fn(async (stmt: { queryChunks?: Array<{ value: unknown }> }) => {
        // sql.raw(statement) produces a SQL object whose first queryChunk
        // holds the raw SQL string. Capture it for assertion.
        const raw =
          stmt?.queryChunks?.[0]?.value ??
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
