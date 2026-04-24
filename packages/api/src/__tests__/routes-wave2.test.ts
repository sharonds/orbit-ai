import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { registerPublicEntityRoutes } from '../routes/entities.js'
import { registerWebhookRoutes } from '../routes/webhooks.js'
import { registerImportRoutes } from '../routes/imports.js'
import { registerWorkflowRoutes } from '../routes/workflows.js'
import { registerRelationshipRoutes } from '../routes/relationships.js'
import { registerObjectRoutes } from '../routes/objects.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { registerOrganizationRoutes } from '../routes/organizations.js'

// --- Helper: create a minimal Hono app with middleware ---

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

describe('Shared pagination validation at the HTTP layer', () => {
  it('rejects invalid limit on generic entity list routes', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerPublicEntityRoutes(app, services)

    const res = await app.request('/v1/activities?limit=abc')
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects invalid limit on admin list routes', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp(['admin:*'])
    registerPublicEntityRoutes(app, services)
    const { registerAdminRoutes } = await import('../routes/admin.js')
    registerAdminRoutes(app, services)

    const res = await app.request('/v1/admin/api_keys?limit=abc')
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects invalid limit on imports list routes', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports?limit=abc')
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects invalid limit on webhook list routes', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks?limit=abc')
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects invalid limit on webhook deliveries routes', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks/wh_01/deliveries?limit=abc')
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })
})

// --- Mock services ---

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

function mockWave2CoreServices(): CoreServices {
  return {
    contacts: mockEntityService(),
    companies: mockEntityService(),
    deals: mockEntityService(),
    pipelines: mockEntityService(),
    stages: mockEntityService(),
    users: mockEntityService(),
    activities: mockEntityService(),
    tasks: mockEntityService(),
    notes: mockEntityService(),
    products: mockEntityService(),
    payments: mockEntityService(),
    contracts: mockEntityService(),
    sequences: mockEntityService(),
    sequenceSteps: mockEntityService(),
    sequenceEnrollments: mockEntityService(),
    sequenceEvents: mockEntityService(),
    tags: mockEntityService(),
    imports: mockEntityService(),
    webhooks: mockEntityService(),
    search: { search: vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null })) },
    contactContext: { getContactContext: vi.fn(async () => null) },
    schema: {},
    system: {
      organizations: mockEntityService(),
      organizationMemberships: mockEntityService(),
      apiKeys: mockEntityService(),
      entityTags: mockEntityService(),
      webhookDeliveries: {
        list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
        get: vi.fn(async () => null),
      },
      customFieldDefinitions: mockEntityService(),
      auditLogs: mockEntityService(),
      schemaMigrations: mockEntityService(),
      idempotencyKeys: mockEntityService(),
    },
  } as unknown as CoreServices
}

// =============================================================================
// Wave 2 public entity routes
// =============================================================================

const WAVE2_ENTITIES = [
  'activities', 'tasks', 'notes', 'products', 'payments',
  'contracts', 'sequences', 'tags',
] as const

describe('Public entity routes — Wave 2', () => {
  for (const entity of WAVE2_ENTITIES) {
    describe(`GET /v1/${entity}`, () => {
      it('returns envelope with data array', async () => {
        const services = mockWave2CoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as {
          data: unknown[]
          meta: { has_more: boolean; request_id: string }
        }
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.meta.request_id).toMatch(/^req_/)
      })
    })

    describe(`GET /v1/${entity}/:id`, () => {
      it('returns single record', async () => {
        const services = mockWave2CoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}/test_01`)
        expect(res.status).toBe(200)
        const body = (await res.json()) as { data: { id: string } }
        expect(body.data.id).toBe('test_01')
      })
    })

    describe(`POST /v1/${entity}`, () => {
      it('creates and returns 201', async () => {
        const services = mockWave2CoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(201)
      })
    })
  }

  // sequence_steps, sequence_enrollments, sequence_events use underscored routes
  describe('Underscore-named entities', () => {
    for (const entity of ['sequence_steps', 'sequence_enrollments'] as const) {
      it(`GET /v1/${entity} returns 200`, async () => {
        const services = mockWave2CoreServices()
        const app = createRouteTestApp()
        registerPublicEntityRoutes(app, services)

        const res = await app.request(`/v1/${entity}`)
        expect(res.status).toBe(200)
      })
    }

    it('GET /v1/sequence_events returns 200', async () => {
      const services = mockWave2CoreServices()
      const app = createRouteTestApp()
      registerPublicEntityRoutes(app, services)

      const res = await app.request('/v1/sequence_events')
      expect(res.status).toBe(200)
    })

    it('POST /v1/sequence_events is not registered (write: false)', async () => {
      const services = mockWave2CoreServices()
      const app = createRouteTestApp()
      registerPublicEntityRoutes(app, services)

      const res = await app.request('/v1/sequence_events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      })
      expect(res.status).toBe(404)
    })
  })
})

// =============================================================================
// Webhook dedicated routes
// =============================================================================

describe('Webhook dedicated routes', () => {
  it('GET /v1/webhooks returns sanitized webhooks', async () => {
    const services = mockWave2CoreServices()
    ;(services.webhooks as any).list.mockResolvedValueOnce({
      data: [{
        id: 'wh_01',
        organization_id: 'org_test',
        url: 'https://example.com/hook',
        events: ['contact.created'],
        status: 'active',
        description: null,
        secret_last_four: 'abcd',
        secret_created_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }],
      hasMore: false,
      nextCursor: null,
    })

    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Array<{ id: string; object: string }> }
    expect(body.data[0]!.object).toBe('webhook')
    expect(body.data[0]!.id).toBe('wh_01')
  })

  it('POST /v1/webhooks rejects non-HTTPS URLs', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://insecure.com/hook', events: ['contact.created'] }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('POST /v1/webhooks accepts HTTPS URLs and returns 201', async () => {
    const services = mockWave2CoreServices()
    ;(services.webhooks as any).create.mockResolvedValueOnce({
      id: 'wh_02',
      organization_id: 'org_test',
      url: 'https://example.com/hook',
      events: ['contact.created'],
      status: 'active',
      description: null,
      signing_secret: 'whsec_full_secret_here',
      secret_last_four: 'here',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook', events: ['contact.created'] }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { signing_secret: string } }
    expect(body.data.signing_secret).toBe('whsec_full_secret_here')
  })

  it('PATCH /v1/webhooks/:id rejects non-HTTPS URL', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks/wh_01', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://bad.com' }),
    })
    expect(res.status).toBe(400)
  })

  it('DELETE /v1/webhooks/:id returns deleted confirmation', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks/wh_01', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { deleted: boolean } }
    expect(body.data.deleted).toBe(true)
  })

  it('POST /v1/webhooks/:id/redeliver returns 501 when not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWebhookRoutes(app, services)

    const res = await app.request('/v1/webhooks/wh_01/redeliver', { method: 'POST' })
    expect(res.status).toBe(501)
  })

  describe('SSRF protection', () => {
    const ssrfUrls = [
      // IPv4
      'https://localhost/hook',
      'https://127.0.0.1/hook',
      'https://10.0.0.1/hook',
      'https://172.16.0.1/hook',
      'https://192.168.1.1/hook',
      'https://169.254.169.254/latest/meta-data/',
      'https://0.0.0.0/hook',
      // IPv6 loopback
      'https://[::1]/hook',
      // IPv4-mapped IPv6 (Node.js normalizes dotted form to hex: ::ffff:7f00:1)
      'https://[::ffff:127.0.0.1]/hook',
      'https://[::ffff:10.0.0.1]/hook',
      'https://[::ffff:192.168.1.1]/hook',
      // IPv4-mapped IPv6 three-group form (bypass vector for regex-only checks)
      'https://[::ffff:0:7f00:1]/hook',
      'https://[::ffff:0:a00:1]/hook',
      // IPv6 link-local and unique-local
      'https://[fe80::1]/hook',
      'https://[fc00::1]/hook',
      'https://[fd12::1]/hook',
      // Cloud metadata
      'https://metadata.google.internal/computeMetadata/v1/',
    ]

    for (const url of ssrfUrls) {
      it(`rejects private/loopback URL: ${url}`, async () => {
        const services = mockWave2CoreServices()
        const app = createRouteTestApp()
        registerWebhookRoutes(app, services)

        const res = await app.request('/v1/webhooks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, events: ['contact.created'] }),
        })
        expect(res.status).toBe(400)
        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('VALIDATION_FAILED')
      })
    }

    it('accepts valid public HTTPS URL', async () => {
      const services = mockWave2CoreServices()
      ;(services.webhooks as any).create.mockResolvedValueOnce({
        id: 'wh_03', organization_id: 'org_test', url: 'https://api.example.com/webhook',
        events: ['contact.created'], status: 'active', description: null,
      })
      const app = createRouteTestApp()
      registerWebhookRoutes(app, services)

      const res = await app.request('/v1/webhooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://api.example.com/webhook', events: ['contact.created'] }),
      })
      expect(res.status).toBe(201)
    })
  })
})

// =============================================================================
// Import dedicated routes
// =============================================================================

describe('Import dedicated routes', () => {
  it('GET /v1/imports returns list', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports')
    expect(res.status).toBe(200)
  })

  it('POST /v1/imports creates and returns 201', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'csv', entity: 'contacts', rows: [] }),
    })
    expect(res.status).toBe(201)
  })

  it('POST /v1/imports rejects a body with no fields at all as VALIDATION_FAILED', async () => {
    const services = mockWave2CoreServices()
    ;(services as any).imports = {
      list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
      get: vi.fn(async () => null),
      create: vi.fn(async (_ctx: any, input: any) => ({ id: 'imp_01', ...input })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('POST /v1/imports rejects an unknown source type as VALIDATION_FAILED', async () => {
    const services = mockWave2CoreServices()
    ;(services as any).imports = {
      list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
      get: vi.fn(async () => null),
      create: vi.fn(async (_ctx: any, input: any) => ({ id: 'imp_01', ...input })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'martian-csv', entity: 'contacts', rows: [] }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('GET /v1/imports/:id returns 404 when not found', async () => {
    const services = mockWave2CoreServices()
    ;(services.imports as any).get.mockResolvedValueOnce(null)
    const app = createRouteTestApp()
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports/imp_missing')
    expect(res.status).toBe(404)
  })
})

// =============================================================================
// Workflow routes
// =============================================================================

describe('Workflow routes', () => {
  it('POST /v1/deals/:id/move returns 501 when not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/deals/d_01/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage_id: 'stg_02' }),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/deals/:id/move rejects non-object JSON bodies before deserialization', async () => {
    const services = mockWave2CoreServices()
    ;(services.deals as any).move = vi.fn()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/deals/d_01/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(null),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect((services.deals as any).move).not.toHaveBeenCalled()
  })

  it('GET /v1/deals/pipeline returns 501 when not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/deals/pipeline')
    expect(res.status).toBe(501)
  })

  it('GET /v1/deals/stats returns 501 when not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/deals/stats')
    expect(res.status).toBe(501)
  })

  it('POST /v1/sequences/:id/enroll returns 501 when not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/sequences/seq_01/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contact_id: 'c_01' }),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/tags/:id/attach returns 501 when not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/tags/tag_01/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity_type: 'contact', entity_id: 'c_01' }),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/activities/log falls back to create if it exists', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/activities/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'call', contact_id: 'c_01' }),
    })
    // create exists on mock, so should succeed with 201
    expect(res.status).toBe(201)
    expect((services.activities as any).create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org_test' }),
      expect.objectContaining({ type: 'call', contactId: 'c_01' }),
    )
  })
})

// =============================================================================
// Relationship routes
// =============================================================================

describe('Relationship routes', () => {
  const RELATIONSHIP_ROUTES = [
    '/v1/contacts/c_01/timeline',
    '/v1/contacts/c_01/deals',
    '/v1/contacts/c_01/activities',
    '/v1/contacts/c_01/tasks',
    '/v1/contacts/c_01/tags',
    '/v1/companies/co_01/contacts',
    '/v1/companies/co_01/deals',
    '/v1/deals/d_01/timeline',
  ]

  for (const route of RELATIONSHIP_ROUTES) {
    it(`GET ${route} returns 501 when not implemented`, async () => {
      const services = mockWave2CoreServices()
      const app = createRouteTestApp()
      registerRelationshipRoutes(app, services)

      const res = await app.request(route)
      expect(res.status).toBe(501)
    })
  }
})

// =============================================================================
// Object / Schema routes
// =============================================================================

describe('Object / Schema routes', () => {
  it('GET /v1/objects returns 501 when schema engine not implemented', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/objects')
    expect(res.status).toBe(501)
  })

  it('GET /v1/objects/:type returns 501', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/objects/contacts')
    expect(res.status).toBe(501)
  })

  it('POST /v1/objects/:type/fields returns 501', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/objects/contacts/fields', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'custom_field', type: 'text' }),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/schema/migrations/preview returns 501', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp()
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/schema/migrations/apply returns 501', async () => {
    const services = mockWave2CoreServices()
    const app = createRouteTestApp(['*'])
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(501)
  })

  it('POST /v1/schema/migrations/preview surfaces JSON parse errors as 400, not 501', async () => {
    const services = mockWave2CoreServices()
    // Make schema.preview exist so the notImplemented guard doesn't short-circuit.
    ;(services as any).schema = {
      preview: vi.fn(async () => ({ ok: true })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  // M-SEC-1: Zod validation for migration preview/apply
  it('POST /v1/schema/migrations/preview accepts empty body and calls service', async () => {
    const services = mockWave2CoreServices()
    ;(services as any).schema = {
      preview: vi.fn(async () => ({ operations: [], destructive: false, status: 'ok' })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    expect((services as any).schema.preview).toHaveBeenCalledTimes(1)
  })

  it('POST /v1/schema/migrations/preview accepts valid non-empty body and calls service', async () => {
    const services = mockWave2CoreServices()
    const mockResult = { migration_id: 'mig_01', sql_statements: [] }
    ;(services as any).schema = {
      preview: vi.fn(async () => mockResult),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity_type: 'contacts', operation: 'add_field' }),
    })
    expect(res.status).toBe(200)
    expect((services as any).schema.preview).toHaveBeenCalledTimes(1)
  })

  it('POST /v1/schema/migrations/apply accepts empty body and calls service', async () => {
    const services = mockWave2CoreServices()
    ;(services as any).schema = {
      apply: vi.fn(async () => ({ applied: [], status: 'ok' })),
    }
    const app = createRouteTestApp(['*'])
    app.onError(orbitErrorHandler)
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    expect((services as any).schema.apply).toHaveBeenCalledTimes(1)
  })

  it('POST /v1/schema/migrations/apply accepts valid non-empty body and calls service', async () => {
    const services = mockWave2CoreServices()
    const mockResult = { migration_id: 'mig_02', applied: true }
    ;(services as any).schema = {
      apply: vi.fn(async () => mockResult),
    }
    const app = createRouteTestApp(['*'])
    app.onError(orbitErrorHandler)
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ migration_id: 'mig_02' }),
    })
    expect(res.status).toBe(200)
    expect((services as any).schema.apply).toHaveBeenCalledTimes(1)
  })
})

// =============================================================================
// Organization routes
// =============================================================================

describe('Organization routes', () => {
  it('GET /v1/organizations/current returns org data', async () => {
    const services = mockWave2CoreServices()
    ;(services.system.organizations as any).get.mockResolvedValueOnce({
      id: 'org_test',
      name: 'Test Org',
    })

    const app = createRouteTestApp()
    registerOrganizationRoutes(app, services)

    const res = await app.request('/v1/organizations/current')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { id: string; name: string } }
    expect(body.data.name).toBe('Test Org')
  })

  it('GET /v1/organizations/current returns 404 when not found', async () => {
    const services = mockWave2CoreServices()
    ;(services.system.organizations as any).get.mockResolvedValueOnce(null)

    const app = createRouteTestApp()
    registerOrganizationRoutes(app, services)

    const res = await app.request('/v1/organizations/current')
    expect(res.status).toBe(404)
  })

  it('PATCH /v1/organizations/current returns 501 when update not implemented', async () => {
    const services = mockWave2CoreServices()
    // Remove update from mock
    delete (services.system.organizations as any).update

    const app = createRouteTestApp()
    registerOrganizationRoutes(app, services)

    const res = await app.request('/v1/organizations/current', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect(res.status).toBe(501)
  })

  it('GET /v1/organizations/current strips internal fields like stripe_customer_id', async () => {
    const services = mockWave2CoreServices()
    ;(services.system.organizations as any).get.mockResolvedValueOnce({
      id: 'org_test',
      name: 'Test Org',
      slug: 'test-org',
      stripe_customer_id: 'cus_secret123', // internal field — must be stripped
      _billing_state: 'active',            // underscore-prefixed internal field
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const app = createRouteTestApp()
    registerOrganizationRoutes(app, services)

    const res = await app.request('/v1/organizations/current')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('name')
    // Internal fields must not be present in the response
    expect(body.data).not.toHaveProperty('stripe_customer_id')
    expect(body.data).not.toHaveProperty('_billing_state')
  })
})

// =============================================================================
// Sanitization tests (H-SEC-1)
// =============================================================================

describe('Workflow route sanitization', () => {
  it('POST /v1/deals/:id/move strips underscore-prefixed fields from response', async () => {
    const services = mockWave2CoreServices()
    ;(services.deals as any).move = vi.fn(async () => ({
      id: 'deal_01',
      title: 'Big Deal',
      _internalFlag: true, // internal field — must be stripped by sanitizePublicRead
      stageId: 'stg_02',
    }))

    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/deals/deal_01/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage_id: 'stg_02' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Record<string, unknown> }
    // Public fields must be present (core title → public name, camelCase → snake_case)
    expect(body.data.id).toBe('deal_01')
    expect(body.data.name).toBe('Big Deal')
    expect(body.data.stage_id).toBe('stg_02')
    // Internal underscore-prefixed field must be stripped
    expect(body.data).not.toHaveProperty('_internalFlag')
  })

  it('POST /v1/sequences/:id/enroll strips underscore-prefixed fields from response', async () => {
    const services = mockWave2CoreServices()
    ;(services.sequences as any).enroll = vi.fn(async () => ({
      id: 'enr_01',
      sequence_id: 'seq_01',
      contact_id: 'con_01',
      status: 'active',
      _billing_state: 'trial', // internal field — must be stripped
    }))

    const app = createRouteTestApp()
    registerWorkflowRoutes(app, services)

    const res = await app.request('/v1/sequences/seq_01/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contact_id: 'con_01' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    // Public fields must be present
    expect(body.data.id).toBe('enr_01')
    expect(body.data.status).toBe('active')
    // Internal underscore-prefixed field must be stripped
    expect(body.data).not.toHaveProperty('_billing_state')
  })
})

describe('Schema route sanitization', () => {
  it('POST /v1/schema/migrations/preview strips underscore-prefixed fields', async () => {
    const services = mockWave2CoreServices()
    ;(services.schema as any).preview = vi.fn(async () => ({
      migration_id: 'mig_01',
      sql_statements: ['ALTER TABLE contacts ADD COLUMN x TEXT'],
      _internal_plan_id: 'plan_secret', // internal field — must be stripped
      estimated_rows: 100,
    }))

    const app = createRouteTestApp()
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity_type: 'contacts', operation: 'add_field' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('migration_id')
    expect(body.data).toHaveProperty('estimated_rows')
    // underscore-prefixed field must be stripped
    expect(body.data).not.toHaveProperty('_internal_plan_id')
  })
})
