import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { registerAdminRoutes } from '../routes/admin.js'
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

function mockAdminService() {
  return {
    list: vi.fn(async () => ({ data: [{ id: 'adm_01' }], nextCursor: null, hasMore: false })),
    get: vi.fn(async () => ({ id: 'adm_01' })),
  }
}

function mockCoreServicesForAdmin(): CoreServices {
  return {
    system: {
      organizationMemberships: mockAdminService(),
      apiKeys: mockAdminService(),
      customFieldDefinitions: mockAdminService(),
      webhookDeliveries: mockAdminService(),
      auditLogs: mockAdminService(),
      schemaMigrations: mockAdminService(),
      idempotencyKeys: mockAdminService(),
      entityTags: mockAdminService(),
      organizations: mockAdminService(),
    },
  } as unknown as CoreServices
}

const ADMIN_ENTITIES = [
  'organization_memberships',
  'api_keys',
  'custom_field_definitions',
  'webhook_deliveries',
  'audit_logs',
  'schema_migrations',
  'idempotency_keys',
  'entity_tags',
] as const

describe('Admin routes — scope enforcement', () => {
  it('rejects requests without admin:* scope', async () => {
    const services = mockCoreServicesForAdmin()
    const app = createRouteTestApp(['contacts:read']) // No admin scope
    registerAdminRoutes(app, services)

    const res = await app.request('/v1/admin/api_keys')
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('AUTH_INSUFFICIENT_SCOPE')
  })

  it('allows requests with admin:* scope', async () => {
    const services = mockCoreServicesForAdmin()
    const app = createRouteTestApp(['admin:*'])
    registerAdminRoutes(app, services)

    const res = await app.request('/v1/admin/api_keys')
    expect(res.status).toBe(200)
  })

  it('allows requests with wildcard scope', async () => {
    const services = mockCoreServicesForAdmin()
    const app = createRouteTestApp(['*'])
    registerAdminRoutes(app, services)

    const res = await app.request('/v1/admin/audit_logs')
    expect(res.status).toBe(200)
  })
})

describe('Admin routes — CRUD', () => {
  for (const entity of ADMIN_ENTITIES) {
    describe(`/v1/admin/${entity}`, () => {
      it('GET list returns envelope', async () => {
        const services = mockCoreServicesForAdmin()
        const app = createRouteTestApp(['admin:*'])
        registerAdminRoutes(app, services)

        const res = await app.request(`/v1/admin/${entity}`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as {
          data: unknown[]
          meta: { request_id: string }
        }
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.meta.request_id).toMatch(/^req_/)
      })

      it('GET /:id returns single record', async () => {
        const services = mockCoreServicesForAdmin()
        const app = createRouteTestApp(['admin:*'])
        registerAdminRoutes(app, services)

        const res = await app.request(`/v1/admin/${entity}/adm_01`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as { data: { id: string } }
        expect(body.data.id).toBe('adm_01')
      })

      it('GET /:id returns 404 when not found', async () => {
        const services = mockCoreServicesForAdmin()
        const serviceMap: Record<string, string> = {
          organization_memberships: 'organizationMemberships',
          api_keys: 'apiKeys',
          custom_field_definitions: 'customFieldDefinitions',
          webhook_deliveries: 'webhookDeliveries',
          audit_logs: 'auditLogs',
          schema_migrations: 'schemaMigrations',
          idempotency_keys: 'idempotencyKeys',
          entity_tags: 'entityTags',
        }
        const svc = services.system[serviceMap[entity] as keyof typeof services.system] as any
        svc.get.mockResolvedValueOnce(null)

        const app = createRouteTestApp(['admin:*'])
        registerAdminRoutes(app, services)

        const res = await app.request(`/v1/admin/${entity}/missing`)
        expect(res.status).toBe(404)
      })
    })
  }
})

describe('Admin sanitization', () => {
  it('sanitizes api_keys by removing keyHash and encryptedKey', async () => {
    const services = mockCoreServicesForAdmin()
    ;(services.system.apiKeys as any).get.mockResolvedValueOnce({
      id: 'key_01',
      name: 'test-key',
      keyHash: 'should_be_removed',
      encryptedKey: 'should_be_removed',
    })

    const app = createRouteTestApp(['admin:*'])
    registerAdminRoutes(app, services)

    const res = await app.request('/v1/admin/api_keys/key_01')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.keyHash).toBeUndefined()
    expect(body.data.encryptedKey).toBeUndefined()
    expect(body.data.name).toBe('test-key')
  })

  it('sanitizes webhook_deliveries with toWebhookDeliveryRead', async () => {
    const services = mockCoreServicesForAdmin()
    ;(services.system.webhookDeliveries as any).get.mockResolvedValueOnce({
      id: 'del_01',
      organization_id: 'org_test',
      webhook_id: 'wh_01',
      event_id: 'evt_01',
      status: 'succeeded',
      response_status: 200,
      attempt_count: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const app = createRouteTestApp(['admin:*'])
    registerAdminRoutes(app, services)

    const res = await app.request('/v1/admin/webhook_deliveries/del_01')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { object: string } }
    expect(body.data.object).toBe('webhook_delivery')
  })
})
