import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { registerBootstrapRoutes } from '../routes/bootstrap.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'

function createRouteTestApp(scopes: string[] = ['*']) {
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

function mockCoreServicesForBootstrap(opts?: {
  orgCreateExists?: boolean
  apiKeyCreateExists?: boolean
}): CoreServices {
  const orgService: Record<string, any> = {
    list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
    get: vi.fn(async () => null),
  }
  if (opts?.orgCreateExists !== false) {
    orgService.create = vi.fn(async (_ctx: any, input: any) => ({
      id: 'org_new',
      ...input,
    }))
  }

  const apiKeyService: Record<string, any> = {
    list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
    get: vi.fn(async () => null),
  }
  if (opts?.apiKeyCreateExists !== false) {
    apiKeyService.create = vi.fn(async (_ctx: any, input: any) => ({
      id: 'key_new',
      api_key: 'sk_test_full_key',
      ...input,
    }))
  }

  return {
    system: {
      organizations: orgService,
      apiKeys: apiKeyService,
    },
  } as unknown as CoreServices
}

describe('Bootstrap routes — scope enforcement', () => {
  it('POST /v1/bootstrap/organizations rejects without platform:bootstrap scope', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['admin:*']) // No bootstrap scope
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Org' }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /v1/bootstrap/api-keys rejects without platform:bootstrap scope', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['admin:*'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'test-key',
        scopes: ['*'],
      }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /v1/bootstrap/organizations succeeds with wildcard scope', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['*'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Org' }),
    })
    expect(res.status).toBe(201)
  })
})

describe('Bootstrap routes — validation', () => {
  it('POST /v1/bootstrap/organizations rejects empty name', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('POST /v1/bootstrap/api-keys rejects missing scopes', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'test',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /v1/bootstrap/api-keys rejects invalid organization_id format', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'not-a-uuid',
        name: 'test',
        scopes: ['*'],
      }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Bootstrap routes — 501 fallback', () => {
  it('POST /v1/bootstrap/organizations returns 501 when create not available', async () => {
    const services = mockCoreServicesForBootstrap({ orgCreateExists: false })
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Org' }),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/bootstrap/api-keys returns 501 when create not available', async () => {
    const services = mockCoreServicesForBootstrap({ apiKeyCreateExists: false })
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'test-key',
        scopes: ['*'],
      }),
    })
    expect(res.status).toBe(501)
  })
})

describe('Bootstrap routes — Orbit prefixed ULID organization_id', () => {
  it('POST /v1/bootstrap/api-keys accepts Orbit prefixed ULID organization_id', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)
    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'test-key',
        scopes: ['contacts:read'],
      }),
    })
    expect(res.status).toBe(201)
  })

  it('POST /v1/bootstrap/api-keys rejects non-Orbit organization_id format', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)
    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'test',
        scopes: ['*'],
      }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Bootstrap routes — success', () => {
  it('POST /v1/bootstrap/organizations creates org and returns 201', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corp', slug: 'acme' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { id: string; name: string } }
    expect(body.data.id).toBe('org_new')
    expect(body.data.name).toBe('Acme Corp')
  })

  it('POST /v1/bootstrap/api-keys creates key and returns 201', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'my-key',
        scopes: ['contacts:read', 'contacts:write'],
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { id: string; api_key: string } }
    expect(body.data.id).toBe('key_new')
    expect(body.data.api_key).toBe('sk_test_full_key')
  })
})

describe('Bootstrap routes — malformed JSON', () => {
  it('returns 400 VALIDATION_FAILED for invalid JSON body', async () => {
    const services = mockCoreServicesForBootstrap()
    const app = createRouteTestApp(['platform:bootstrap'])
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ invalid json ',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; hint: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.hint).toBeDefined()
  })
})

describe('Bootstrap routes — response sanitization', () => {
  it('POST /v1/bootstrap/organizations strips internal fields from the response', async () => {
    const services = {
      system: {
        organizations: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
          create: vi.fn(async () => ({
            id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
            name: 'Acme',
            slug: 'acme',
            created_at: '2026-04-08T00:00:00Z',
            // internal fields that must NOT leak
            _internal_billing_state: 'trial',
            _row_version: 42,
            stripe_customer_id: 'cus_secret',
          })),
        },
        apiKeys: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
        },
      },
    } as unknown as CoreServices

    const app = createRouteTestApp()
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('name', 'Acme')
    expect(body.data).not.toHaveProperty('_internal_billing_state')
    expect(body.data).not.toHaveProperty('_row_version')
    expect(body.data).not.toHaveProperty('stripe_customer_id')
  })

  it('POST /v1/bootstrap/api-keys strips internal fields from the response', async () => {
    const services = {
      system: {
        organizations: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
        },
        apiKeys: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
          create: vi.fn(async () => ({
            id: 'ak_01ARYZ6S41YYYYYYYYYYYYYYYY',
            name: 'Test Key',
            scopes: ['contacts:read'],
            api_key: 'sk_test_the_raw_key',
            created_at: '2026-04-08T00:00:00Z',
            // internal fields that must NOT leak
            _hashed_key: 'abc123hash',
            _salt: 'saltsalt',
          })),
        },
      },
    } as unknown as CoreServices

    const app = createRouteTestApp()
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Test Key',
        scopes: ['contacts:read'],
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('api_key') // the raw key IS intentionally returned once on creation
    expect(body.data).not.toHaveProperty('_hashed_key')
    expect(body.data).not.toHaveProperty('_salt')
  })
})
