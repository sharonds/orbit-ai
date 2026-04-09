import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { resolvePublicEntityServiceKey } from '@orbit-ai/core'
import { toEnvelope, toError, sanitizePublicRead, sanitizePublicPage } from '../responses.js'
import { requireScope } from '../scopes.js'
import { paginationParams } from '../utils/pagination.js'
import { PUBLIC_ENTITY_CAPABILITIES, type PublicEntityName } from './entity-capabilities.js'

function resolveService(services: CoreServices, entity: PublicEntityName) {
  const serviceKey = resolvePublicEntityServiceKey(entity)
  return services[serviceKey as keyof CoreServices] as any
}

export function registerPublicEntityRoutes(app: Hono, services: CoreServices) {
  for (const [entity, capabilities] of Object.entries(PUBLIC_ENTITY_CAPABILITIES)) {
    const typedEntity = entity as PublicEntityName

    // GET /v1/<entity> — list
    app.get(`/v1/${entity}`, requireScope(`${entity}:read`), async (c) => {
      const { limit, cursor } = paginationParams(c)
      const include = c.req.query('include')?.split(',').filter(Boolean)
      const service = resolveService(services, typedEntity)
      const result = await service.list(c.get('orbit'), { limit, cursor, include })
      return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result))
    })

    // POST /v1/<entity> — create
    if (capabilities.write) {
      app.post(`/v1/${entity}`, requireScope(`${entity}:write`), async (c) => {
        const service = resolveService(services, typedEntity)
        const body = await c.req.json()
        const created = await service.create(c.get('orbit'), body)
        return c.json(toEnvelope(c, sanitizePublicRead(entity, created)), 201)
      })
    }

    // GET /v1/<entity>/:id — get
    app.get(`/v1/${entity}/:id`, requireScope(`${entity}:read`), async (c) => {
      const service = resolveService(services, typedEntity)
      const record = await service.get(c.get('orbit'), c.req.param('id'))
      if (!record) return c.json(toError(c, 'RESOURCE_NOT_FOUND', `${entity} not found`), 404)
      return c.json(toEnvelope(c, sanitizePublicRead(entity, record)))
    })

    // PATCH /v1/<entity>/:id — update
    if (capabilities.write) {
      app.patch(`/v1/${entity}/:id`, requireScope(`${entity}:write`), async (c) => {
        const service = resolveService(services, typedEntity)
        const record = await service.update(c.get('orbit'), c.req.param('id'), await c.req.json())
        return c.json(toEnvelope(c, sanitizePublicRead(entity, record)))
      })
    }

    // DELETE /v1/<entity>/:id — delete
    if (capabilities.write) {
      app.delete(`/v1/${entity}/:id`, requireScope(`${entity}:write`), async (c) => {
        const service = resolveService(services, typedEntity)
        await service.delete(c.get('orbit'), c.req.param('id'))
        return c.json(toEnvelope(c, { id: c.req.param('id'), deleted: true }))
      })
    }

    // POST /v1/<entity>/search — body-paginated: omit links.next (cursor must stay in request body)
    app.post(`/v1/${entity}/search`, requireScope(`${entity}:read`), async (c) => {
      const service = resolveService(services, typedEntity)
      const result = await service.search(c.get('orbit'), await c.req.json())
      return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result, { omitNextLink: true }))
    })

    // POST /v1/<entity>/batch (only if capable)
    if (capabilities.batch) {
      app.post(`/v1/${entity}/batch`, requireScope(`${entity}:write`), async (c) => {
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
