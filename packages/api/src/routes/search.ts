import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope } from '../responses.js'
import { requireScope } from '../scopes.js'

export function registerSearchRoutes(app: Hono, services: CoreServices) {
  app.post('/v1/search', requireScope('search:read'), async (c) => {
    const body = await c.req.json()
    const result = await services.search.search(c.get('orbit'), {
      query: body.query,
      limit: body.limit,
      cursor: body.cursor,
    })
    return c.json(toEnvelope(c, result.data, result))
  })
}
