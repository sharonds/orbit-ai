import { describe, expect, it, vi } from 'vitest'

import type { OrbitDatabase, StorageAdapter } from './interface.js'
import { createTxBoundAdapter } from './tx-bound-adapter.js'

function createFakeAdapter(): StorageAdapter {
  return {
    name: 'sqlite',
    dialect: 'sqlite',
    supportsRls: false,
    supportsBranching: false,
    supportsJsonbIndexes: false,
    authorityModel: {
      runtimeAuthority: 'request-scoped',
      migrationAuthority: 'elevated',
      requestPathMayUseElevatedCredentials: false,
      notes: [],
    },
    unsafeRawDatabase: {} as OrbitDatabase,
    users: {
      async resolveByExternalAuthId() {
        return null
      },
      async upsertFromAuth() {
        return 'user_test'
      },
    },
    async connect() {},
    async disconnect() {},
    async migrate() {},
    async runWithMigrationAuthority(fn) {
      return fn({} as never)
    },
    async lookupApiKeyForAuth() {
      return null
    },
    async transaction(fn) {
      return fn({} as OrbitDatabase)
    },
    beginTransaction() {
      return {
        async run(_ctx, fn) {
          return fn({} as OrbitDatabase)
        },
      }
    },
    async execute() {
      return undefined
    },
    async query() {
      return []
    },
    async withTenantContext(_ctx, fn) {
      return fn({} as OrbitDatabase)
    },
    async getSchemaSnapshot() {
      return { customFields: [], tables: [] }
    },
  }
}

describe('createTxBoundAdapter', () => {
  const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' }

  it('routes withTenantContext through the supplied txDb', async () => {
    const base = createFakeAdapter()
    const txDb = { tag: 'tx' } as unknown as OrbitDatabase
    const bound = createTxBoundAdapter(base, txDb)

    const captured: unknown[] = []
    await bound.withTenantContext(ctx, async (db) => {
      captured.push(db)
    })

    expect(captured[0]).toBe(txDb)
  })

  it('exposes the txDb as unsafeRawDatabase', () => {
    const base = createFakeAdapter()
    const txDb = { tag: 'tx' } as unknown as OrbitDatabase
    const bound = createTxBoundAdapter(base, txDb)
    expect(bound.unsafeRawDatabase).toBe(txDb)
  })

  describe('refuses methods that would leak out of the enclosing transaction', () => {
    const base = createFakeAdapter()
    const txDb = {} as OrbitDatabase
    const bound = createTxBoundAdapter(base, txDb)

    it('refuses transaction()', () => {
      expect(() => bound.transaction(async () => undefined)).toThrow(
        /transaction.*not available/,
      )
    })

    it('refuses beginTransaction()', () => {
      expect(() => bound.beginTransaction()).toThrow(/beginTransaction.*not available/)
    })

    it('refuses execute()', () => {
      // execute returns a Promise so the call itself throws synchronously
      // because the Proxy returns a function that throws.
      expect(() => bound.execute({} as never)).toThrow(/execute.*not available/)
    })

    it('refuses query()', () => {
      expect(() => bound.query({} as never)).toThrow(/query.*not available/)
    })

    it('refuses runWithMigrationAuthority()', () => {
      expect(() => bound.runWithMigrationAuthority(async () => undefined)).toThrow(
        /runWithMigrationAuthority.*not available/,
      )
    })
  })

  it('passes through harmless metadata properties', () => {
    const base = createFakeAdapter()
    const bound = createTxBoundAdapter(base, {} as OrbitDatabase)
    expect(bound.name).toBe('sqlite')
    expect(bound.dialect).toBe('sqlite')
    expect(bound.supportsRls).toBe(false)
  })

  it('does not interfere with non-leaking methods like getSchemaSnapshot', async () => {
    const base = createFakeAdapter()
    const spy = vi.spyOn(base, 'getSchemaSnapshot')
    const bound = createTxBoundAdapter(base, {} as OrbitDatabase)
    await bound.getSchemaSnapshot()
    expect(spy).toHaveBeenCalled()
  })
})
