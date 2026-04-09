import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requireScope } from '../scopes.js'
import { toEnvelope, toError, sanitizeAdminRead, sanitizeAdminPage } from '../responses.js'

const ADMIN_ENTITIES = {
  organization_memberships: 'organizationMemberships',
  api_keys: 'apiKeys',
  custom_field_definitions: 'customFieldDefinitions',
  webhook_deliveries: 'webhookDeliveries',
  audit_logs: 'auditLogs',
  schema_migrations: 'schemaMigrations',
  idempotency_keys: 'idempotencyKeys',
  entity_tags: 'entityTags',
} as const

type AdminEntityRoute = keyof typeof ADMIN_ENTITIES
type AdminServiceKey = (typeof ADMIN_ENTITIES)[AdminEntityRoute]

function resolveAdminService(services: CoreServices, serviceKey: AdminServiceKey) {
  return services.system[serviceKey as keyof typeof services.system] as any
}

export function registerAdminRoutes(app: Hono, services: CoreServices) {
  // All admin routes require admin:* scope
  app.use('/v1/admin/*', requireScope('admin:*'))

  for (const [route, serviceKey] of Object.entries(ADMIN_ENTITIES)) {
    const typedRoute = route as AdminEntityRoute

    // GET /v1/admin/<entity> — list
    app.get(`/v1/admin/${route}`, requireScope('admin:*'), async (c) => {
      const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
      const cursor = c.req.query('cursor') ?? undefined
      const service = resolveAdminService(services, serviceKey)
      const result = await service.list(c.get('orbit'), { limit, cursor })
      return c.json(toEnvelope(c, sanitizeAdminPage(typedRoute, result.data), result))
    })

    // GET /v1/admin/<entity>/:id — get
    app.get(`/v1/admin/${route}/:id`, requireScope('admin:*'), async (c) => {
      const service = resolveAdminService(services, serviceKey)
      const record = await service.get(c.get('orbit'), c.req.param('id'))
      if (!record) return c.json(toError(c, 'RESOURCE_NOT_FOUND', `${route} not found`), 404)
      return c.json(toEnvelope(c, sanitizeAdminRead(typedRoute, record)))
    })
  }
}
