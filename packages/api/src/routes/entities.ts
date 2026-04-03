import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError, sanitizePublicRead, sanitizePublicPage } from '../responses.js'

const PUBLIC_ENTITY_CAPABILITIES = {
  contacts: { read: true, write: true, batch: true },
  companies: { read: true, write: true, batch: true },
  deals: { read: true, write: true, batch: true },
  pipelines: { read: true, write: true, batch: false },
  stages: { read: true, write: true, batch: false },
  users: { read: true, write: true, batch: false },
} as const

type PublicEntityName = keyof typeof PUBLIC_ENTITY_CAPABILITIES

function resolveService(services: CoreServices, entity: PublicEntityName) {
  return services[entity as keyof CoreServices] as any
}

export function registerPublicEntityRoutes(app: Hono, services: CoreServices) {
  for (const [entity, capabilities] of Object.entries(PUBLIC_ENTITY_CAPABILITIES)) {
    const typedEntity = entity as PublicEntityName

    // GET /v1/<entity> — list
    app.get(`/v1/${entity}`, async (c) => {
      const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
      const cursor = c.req.query('cursor') ?? undefined
      const include = c.req.query('include')?.split(',').filter(Boolean)
      const service = resolveService(services, typedEntity)
      const result = await service.list(c.get('orbit'), { limit, cursor, include })
      return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result))
    })

    // POST /v1/<entity> — create
    if (capabilities.write) {
      app.post(`/v1/${entity}`, async (c) => {
        const service = resolveService(services, typedEntity)
        const body = await c.req.json()
        const created = await service.create(c.get('orbit'), body)
        return c.json(toEnvelope(c, sanitizePublicRead(entity, created)), 201)
      })
    }

    // GET /v1/<entity>/:id — get
    app.get(`/v1/${entity}/:id`, async (c) => {
      const service = resolveService(services, typedEntity)
      const record = await service.get(c.get('orbit'), c.req.param('id'))
      if (!record) return c.json(toError(c, 'RESOURCE_NOT_FOUND', `${entity} not found`), 404)
      return c.json(toEnvelope(c, sanitizePublicRead(entity, record)))
    })

    // PATCH /v1/<entity>/:id — update
    if (capabilities.write) {
      app.patch(`/v1/${entity}/:id`, async (c) => {
        const service = resolveService(services, typedEntity)
        const record = await service.update(c.get('orbit'), c.req.param('id'), await c.req.json())
        return c.json(toEnvelope(c, sanitizePublicRead(entity, record)))
      })
    }

    // DELETE /v1/<entity>/:id — delete
    if (capabilities.write) {
      app.delete(`/v1/${entity}/:id`, async (c) => {
        const service = resolveService(services, typedEntity)
        await service.delete(c.get('orbit'), c.req.param('id'))
        return c.json(toEnvelope(c, { id: c.req.param('id'), deleted: true }))
      })
    }

    // POST /v1/<entity>/search
    app.post(`/v1/${entity}/search`, async (c) => {
      const service = resolveService(services, typedEntity)
      const result = await service.search(c.get('orbit'), await c.req.json())
      return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result))
    })

    // POST /v1/<entity>/batch (only if capable)
    if (capabilities.batch) {
      app.post(`/v1/${entity}/batch`, async (c) => {
        const service = resolveService(services, typedEntity)
        const body = await c.req.json()
        if (typeof service.batch === 'function') {
          const result = await service.batch(c.get('orbit'), body)
          return c.json(toEnvelope(c, result))
        }
        return c.json(toError(c, 'INTERNAL_ERROR', 'Batch not implemented for this entity'), 501)
      })
    }
  }
}
