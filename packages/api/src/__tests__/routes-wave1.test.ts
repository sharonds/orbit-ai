import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { createApi } from '../create-api.js'
import type { RuntimeApiAdapter } from '../config.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { registerHealthCheck, registerStatusRoute } from '../routes/health.js'
import { registerSearchRoutes } from '../routes/search.js'
import { registerContextRoutes } from '../routes/context.js'

// --- Stub adapter for full-stack integration tests ---

function stubAdapter(): RuntimeApiAdapter {
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

// --- Helper: create a minimal Hono app with middleware for isolated route tests ---

function createRouteTestApp() {
  const app = new Hono()
  app.use('*', requestIdMiddleware())
  app.use('/v1/*', versionMiddleware('2026-04-01'))
  // Set a fake orbit context for authenticated route tests
  app.use('/v1/*', async (c, next) => {
    c.set('orbit', {
      orgId: 'org_test',
      apiKeyId: 'key_test',
      scopes: ['*'],
    })
    await next()
  })
  return app
}

// --- Mock services ---

function mockCoreServices(overrides: Partial<CoreServices> = {}): CoreServices {
  return {
    search: {
      search: vi.fn(async () => ({
        data: [],
        hasMore: false,
        nextCursor: null,
      })),
    },
    contactContext: {
      getContactContext: vi.fn(async () => null),
    },
    ...overrides,
  } as unknown as CoreServices
}

// =============================================================================
// Health routes
// =============================================================================

describe('GET /health', () => {
  it('returns 200 with status ok and no auth required', async () => {
    const app = createRouteTestApp()
    registerHealthCheck(app)

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; timestamp: string }
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeTruthy()
  })
})

describe('GET /v1/status', () => {
  it('returns envelope with version and status when authenticated', async () => {
    const app = createRouteTestApp()
    registerStatusRoute(app)

    const res = await app.request('/v1/status')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { status: string; version: string; timestamp: string }
      meta: { version: string; request_id: string }
    }
    expect(body.data.status).toBe('ok')
    expect(body.data.version).toBe('2026-04-01')
    expect(body.meta.version).toBe('2026-04-01')
    expect(body.meta.request_id).toMatch(/^req_/)
  })

  it('returns 401 without auth via full createApi stack', async () => {
    const services = mockCoreServices()
    const app = createApi({ adapter: stubAdapter(), version: '2026-04-01', services })

    const res = await app.request('/v1/status')
    // Auth middleware rejects — no bearer token
    expect(res.status).toBe(401)
  })
})

// =============================================================================
// Search routes
// =============================================================================

describe('POST /v1/search', () => {
  it('calls search service and returns envelope', async () => {
    const searchMock = vi.fn(async () => ({
      data: [
        {
          objectType: 'contact',
          id: 'c_001',
          title: 'Alice',
          subtitle: 'alice@example.com',
          record: { id: 'c_001', name: 'Alice' },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      hasMore: false,
      nextCursor: null,
    }))
    const services = mockCoreServices({
      search: { search: searchMock },
    } as any)

    const app = createRouteTestApp()
    registerSearchRoutes(app, services)

    const res = await app.request('/v1/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'alice', limit: 10 }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: Array<{ id: string; title: string }>
      meta: { has_more: boolean }
    }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]!.title).toBe('Alice')
    expect(body.meta.has_more).toBe(false)

    expect(searchMock).toHaveBeenCalledWith(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: 'alice', limit: 10, cursor: undefined },
    )
  })

  it('passes pagination cursor through', async () => {
    const searchMock = vi.fn(async () => ({
      data: [],
      hasMore: true,
      nextCursor: 'cur_next',
    }))
    const services = mockCoreServices({
      search: { search: searchMock },
    } as any)

    const app = createRouteTestApp()
    registerSearchRoutes(app, services)

    const res = await app.request('/v1/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'test', cursor: 'cur_prev' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      meta: { has_more: boolean; next_cursor: string | null }
    }
    expect(body.meta.has_more).toBe(true)
    expect(body.meta.next_cursor).toBe('cur_next')

    expect(searchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cursor: 'cur_prev' }),
    )
  })
})

// =============================================================================
// Context routes
// =============================================================================

describe('GET /v1/context/:contactId', () => {
  it('returns contact context when found', async () => {
    const contextResult = {
      contact: { id: 'c_001', name: 'Alice' },
      company: null,
      openDeals: [],
      openTasks: [],
      recentActivities: [],
      tags: [],
      lastContactDate: null,
    }
    const getContactContext = vi.fn(async () => contextResult)
    const services = mockCoreServices({
      contactContext: { getContactContext },
    } as any)

    const app = createRouteTestApp()
    registerContextRoutes(app, services)

    const res = await app.request('/v1/context/c_001')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { contact: { id: string } }
      meta: { request_id: string }
    }
    expect(body.data.contact.id).toBe('c_001')
    expect(body.meta.request_id).toMatch(/^req_/)

    expect(getContactContext).toHaveBeenCalledWith(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { contactId: 'c_001' },
    )
  })

  it('returns 404 when contact not found', async () => {
    const getContactContext = vi.fn(async () => null)
    const services = mockCoreServices({
      contactContext: { getContactContext },
    } as any)

    const app = createRouteTestApp()
    registerContextRoutes(app, services)

    const res = await app.request('/v1/context/c_missing')
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: { code: string; message: string }
    }
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
    expect(body.error.message).toMatch(/contact not found/i)
  })
})
