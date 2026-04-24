import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { createApi } from '../create-api.js'
import type { RuntimeApiAdapter } from '../config.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { registerHealthCheck, registerStatusRoute } from '../routes/health.js'
import { registerSearchRoutes } from '../routes/search.js'
import { registerContextRoutes } from '../routes/context.js'
import { registerPublicEntityRoutes } from '../routes/entities.js'

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
      data: Array<{ id: string; object_type: string; objectType?: string; title: string; updated_at: string; updatedAt?: string }>
      meta: { has_more: boolean }
    }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]!.object_type).toBe('contact')
    expect(body.data[0]).not.toHaveProperty('objectType')
    expect(body.data[0]!.updated_at).toBe('2026-01-01T00:00:00.000Z')
    expect(body.data[0]).not.toHaveProperty('updatedAt')
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

// =============================================================================
// Public entity routes (Wave 1)
// =============================================================================

function mockEntityService() {
  return {
    list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
    get: vi.fn(async () => ({ id: 'test_01' })),
    create: vi.fn(async (_ctx: any, input: any) => ({ id: 'test_01', ...input })),
    update: vi.fn(async (_ctx: any, _id: string, input: any) => ({ id: 'test_01', ...input })),
    delete: vi.fn(async () => {}),
    search: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
  }
}

function mockEntityCoreServices(): CoreServices {
  return {
    contacts: mockEntityService(),
    companies: mockEntityService(),
    deals: mockEntityService(),
    pipelines: mockEntityService(),
    stages: mockEntityService(),
    users: mockEntityService(),
    search: { search: vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null })) },
    contactContext: { getContactContext: vi.fn(async () => null) },
  } as unknown as CoreServices
}

const WAVE1_ENTITIES = ['contacts', 'companies', 'deals', 'pipelines', 'stages', 'users'] as const

describe('Public entity routes — Wave 1', () => {
  for (const entity of WAVE1_ENTITIES) {
    describe(`GET /v1/${entity}`, () => {
      it('returns envelope with data array', async () => {
        const services = mockEntityCoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as {
          data: unknown[]
          meta: { has_more: boolean; next_cursor: string | null; request_id: string }
        }
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.meta.has_more).toBe(false)
        expect(body.meta.request_id).toMatch(/^req_/)
      })
    })

    describe(`POST /v1/${entity}/search`, () => {
      it('returns envelope with data array', async () => {
        const services = mockEntityCoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}/search`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
        })
        expect(res.status).toBe(200)
        const body = (await res.json()) as {
          data: unknown[]
          meta: { has_more: boolean }
        }
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.meta.has_more).toBe(false)
      })
    })

    describe(`GET /v1/${entity}/:id`, () => {
      it('returns envelope with single record', async () => {
        const services = mockEntityCoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}/test_01`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as { data: { id: string } }
        expect(body.data.id).toBe('test_01')
      })

      it('returns 404 when not found', async () => {
        const services = mockEntityCoreServices()
        const svc = services[entity as keyof CoreServices] as any
        svc.get.mockResolvedValueOnce(null)
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}/missing_01`)
        expect(res.status).toBe(404)
        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
      })
    })

    describe(`POST /v1/${entity}`, () => {
      it('creates and returns 201', async () => {
        const services = mockEntityCoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(201)
        const body = (await res.json()) as { data: { id: string } }
        expect(body.data.id).toBe('test_01')
      })
    })

    describe(`PATCH /v1/${entity}/:id`, () => {
      it('updates and returns 200', async () => {
        const services = mockEntityCoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}/test_01`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        })
        expect(res.status).toBe(200)
        const body = (await res.json()) as { data: { id: string } }
        expect(body.data.id).toBe('test_01')
      })
    })

    describe(`DELETE /v1/${entity}/:id`, () => {
      it('deletes and returns deleted confirmation', async () => {
        const services = mockEntityCoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}/test_01`, { method: 'DELETE' })
        expect(res.status).toBe(200)
        const body = (await res.json()) as { data: { id: string; deleted: boolean } }
        expect(body.data.id).toBe('test_01')
        expect(body.data.deleted).toBe(true)
      })
    })
  }
})

// =============================================================================
// Scope enforcement on entity routes
// =============================================================================

function createScopedRouteTestApp(scopes: string[]) {
  const app = new Hono()
  app.onError(orbitErrorHandler)
  app.use('*', requestIdMiddleware())
  app.use('/v1/*', versionMiddleware('2026-04-01'))
  app.use('/v1/*', async (c, next) => {
    c.set('orbit', {
      orgId: 'org_test',
      apiKeyId: 'key_test',
      scopes,
    })
    await next()
  })
  return app
}

describe('scope enforcement', () => {
  it('GET /v1/contacts returns 403 without contacts:read scope', async () => {
    const services = mockEntityCoreServices()
    const app = createScopedRouteTestApp(['deals:read'])
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/contacts')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('AUTH_INSUFFICIENT_SCOPE')
  })

  it('POST /v1/contacts returns 403 without contacts:write scope', async () => {
    const services = mockEntityCoreServices()
    const app = createScopedRouteTestApp(['contacts:read'])
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('AUTH_INSUFFICIENT_SCOPE')
  })

  it('GET /v1/contacts passes with contacts:read scope', async () => {
    const services = mockEntityCoreServices()
    const app = createScopedRouteTestApp(['contacts:read'])
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/contacts')
    expect(res.status).toBe(200)
  })

  it('GET /v1/contacts passes with wildcard scope', async () => {
    const services = mockEntityCoreServices()
    const app = createScopedRouteTestApp(['*'])
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/contacts')
    expect(res.status).toBe(200)
  })
})

describe('Non-public entity routes return 404', () => {
  it('GET /v1/organizations returns 404', async () => {
    const services = mockEntityCoreServices()
    const app = createRouteTestApp()
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/organizations')
    expect(res.status).toBe(404)
  })

  it('GET /v1/audit_logs returns 404', async () => {
    const services = mockEntityCoreServices()
    const app = createRouteTestApp()
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/audit_logs')
    expect(res.status).toBe(404)
  })
})

// =============================================================================
// Body size limit (H-SEC-2)
// =============================================================================

describe('HTTP body size limit via createApi', () => {
  it('returns 413 PAYLOAD_TOO_LARGE when POST body exceeds the limit', async () => {
    const services = mockEntityCoreServices()
    const app = createApi({
      adapter: stubAdapter(),
      version: '2026-04-01',
      services: services as unknown as CoreServices,
      maxRequestBodySize: 100, // tiny limit for test
    })

    // Bypass auth by monkey-patching — the body-limit middleware runs before
    // auth, so we can observe the 413 from the full createApi stack by adding
    // an Authorization header that the stub adapter accepts (or we just check
    // body-limit fires before auth).
    //
    // Actually, the bodyLimit middleware is registered BEFORE authMiddleware on
    // /v1/*, so a huge body will be rejected with 413 before auth runs.
    const bigBody = JSON.stringify({ data: 'x'.repeat(200) }) // > 100 bytes
    const res = await app.request('/v1/contacts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Hono's test harness doesn't set content-length automatically;
        // bodyLimit uses it for the fast-path check before auth runs.
        'content-length': String(Buffer.byteLength(bigBody, 'utf8')),
      },
      body: bigBody,
    })

    expect(res.status).toBe(413)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE')
    expect(body.error.message).toMatch(/maximum allowed size/i)
  })

  it('accepts POST body within the default 1MB limit', async () => {
    const services = mockEntityCoreServices()
    const app = createApi({
      adapter: stubAdapter(),
      version: '2026-04-01',
      services: services as unknown as CoreServices,
    })

    // A request under 1MB passes body-limit and hits auth (which returns 401
    // because the stub adapter returns null for API key lookup).
    const smallBody = JSON.stringify({ name: 'Test' })
    const res = await app.request('/v1/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: smallBody,
    })

    // Should reach auth middleware (401), not be blocked by body-limit (413)
    expect(res.status).toBe(401)
  })
})
