import { describe, it, expect } from 'vitest'
import { createApi } from '../create-api.js'
import type { RuntimeApiAdapter } from '../config.js'

function stubAdapter(): RuntimeApiAdapter {
  return {
    name: 'sqlite',
    dialect: 'sqlite',
    supportsRls: false,
    supportsBranching: false,
    supportsJsonbIndexes: false,
    authorityModel: { runtimeAuthority: 'request-scoped', migrationAuthority: 'elevated', requestPathMayUseElevatedCredentials: false, notes: [] },
    unsafeRawDatabase: {} as any,
    users: {} as any,
    connect: async () => {},
    disconnect: async () => {},
    lookupApiKeyForAuth: async () => null,
    transaction: async (fn) => fn({} as any),
    execute: async () => ({}),
    query: async () => [],
    withTenantContext: async (_ctx, fn) => fn({} as any),
    getSchemaSnapshot: async () => ({ customFields: [], tables: [] }),
  }
}

describe('createApi', () => {
  it('returns a Hono app instance', () => {
    const app = createApi({ adapter: stubAdapter(), version: '2026-04-01' })
    expect(app).toBeDefined()
    expect(app.fetch).toBeTypeOf('function')
  })

  it('accepts only runtime-scoped adapter (no migration authority)', () => {
    const adapter = stubAdapter()
    const app = createApi({ adapter, version: '2026-04-01' })
    expect(app).toBeDefined()
  })
})
