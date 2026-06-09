import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { CoreServices } from '@orbit-ai/core'
import { createCoreServicesForRuntimeAdapter } from '@orbit-ai/core'
import { createApi } from '../create-api.js'
import type { RuntimeApiAdapter } from '../config.js'

vi.mock('@orbit-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orbit-ai/core')>()
  return {
    ...actual,
    createCoreServicesForRuntimeAdapter: vi.fn(() => stubServices()),
  }
})

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

function stubServices(): CoreServices {
  return {
    search: { search: async () => ({ data: [], hasMore: false, nextCursor: null }) },
    contactContext: { getContactContext: async () => null },
  } as unknown as CoreServices
}

describe('createApi', () => {
  beforeEach(() => {
    vi.mocked(createCoreServicesForRuntimeAdapter).mockClear()
  })

  it('returns a Hono app instance', () => {
    const app = createApi({ adapter: stubAdapter(), version: '2026-04-01', services: stubServices() })
    expect(app).toBeDefined()
    expect(app.fetch).toBeTypeOf('function')
  })

  it('accepts only runtime-scoped adapter (no migration authority)', () => {
    const adapter = stubAdapter()
    const app = createApi({ adapter, version: '2026-04-01', services: stubServices() })
    expect(app).toBeDefined()
  })

  it('passes destructive migration environment into generated core services', () => {
    const adapter = stubAdapter()
    const app = createApi({
      adapter,
      version: '2026-04-01',
      destructiveMigrationEnvironment: 'production',
    })

    expect(app).toBeDefined()
    expect(createCoreServicesForRuntimeAdapter).toHaveBeenCalledWith(adapter, {
      destructiveMigrationEnvironment: 'production',
    })
  })

  it('passes only explicitly configured migration authority into generated core services', () => {
    const adapter = stubAdapter()
    const migrationAuthority = {
      run: vi.fn(async <T>(_context: unknown, fn: (db: unknown) => Promise<T>) => fn({})),
    }
    const app = createApi({
      adapter,
      version: '2026-04-01',
      migrationAuthority,
    })

    expect(app).toBeDefined()
    expect(createCoreServicesForRuntimeAdapter).toHaveBeenCalledWith(adapter, {
      migrationAuthority,
    })
  })
})
