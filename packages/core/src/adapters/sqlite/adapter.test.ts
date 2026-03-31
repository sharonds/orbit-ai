import { describe, expect, it, vi } from 'vitest'

import type { OrbitDatabase } from '../interface.js'
import { asMigrationDatabase } from '../interface.js'
import { createSqliteStorageAdapter } from './adapter.js'

describe('SqliteStorageAdapter', () => {
  it('exposes the expected sqlite capability baseline', () => {
    const database = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(database),
      execute: async () => undefined,
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
    } satisfies OrbitDatabase
    const migrationDatabase = asMigrationDatabase({
      transaction: async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(runtimeDatabase),
      execute: async () => undefined,
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
    } as OrbitDatabase
    const adapter = createSqliteStorageAdapter({ database })

    await expect(adapter.withTenantContext({ orgId: '' }, async () => 'ok')).rejects.toThrow(
      'Expected organization ID with prefix "org_"',
    )
    expect(transaction).not.toHaveBeenCalled()
  })
})
