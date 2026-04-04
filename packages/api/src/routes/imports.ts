import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'

export function registerImportRoutes(app: Hono, services: CoreServices) {
  // GET /v1/imports — list
  app.get('/v1/imports', requireScope('imports:read'), async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
    const cursor = c.req.query('cursor') ?? undefined
    const service = services.imports as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    return c.json(toEnvelope(c, result.data, result))
  })

  // POST /v1/imports — create
  app.post('/v1/imports', requireScope('imports:write'), async (c) => {
    const service = services.imports as any
    const body = await c.req.json()
    const created = await service.create(c.get('orbit'), body)
    return c.json(toEnvelope(c, created), 201)
  })

  // GET /v1/imports/:id — get
  app.get('/v1/imports/:id', requireScope('imports:read'), async (c) => {
    const service = services.imports as any
    const record = await service.get(c.get('orbit'), c.req.param('id'))
    if (!record) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Import not found'), 404)
    }
    return c.json(toEnvelope(c, record))
  })
}
