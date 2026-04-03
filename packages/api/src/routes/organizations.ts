import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'

export function registerOrganizationRoutes(app: Hono, services: CoreServices) {
  // GET /v1/organizations/current — returns current org
  app.get('/v1/organizations/current', async (c) => {
    const ctx = c.get('orbit')
    const service = services.system.organizations as any
    const record = await service.get(ctx, ctx.orgId)
    if (!record) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Organization not found'), 404)
    }
    return c.json(toEnvelope(c, record))
  })

  // PATCH /v1/organizations/current — updates current org
  app.patch('/v1/organizations/current', async (c) => {
    const ctx = c.get('orbit')
    const service = services.system.organizations as any
    if (typeof service.update !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Organization update not implemented'), 501)
    }
    const body = await c.req.json()
    const record = await service.update(ctx, ctx.orgId, body)
    return c.json(toEnvelope(c, record))
  })
}
