import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { SEARCHABLE_OBJECT_TYPES } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'
import { serializeSearchPage } from '../serialization.js'
import { z } from 'zod'

const SearchBodySchema = z.object({
  query: z.string().optional(),
  object_types: z.array(z.enum(SEARCHABLE_OBJECT_TYPES)).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export function registerSearchRoutes(app: Hono, services: CoreServices) {
  app.post('/v1/search', requireScope('search:read'), async (c) => {
    const body = await c.req.json()
    const parsed = SearchBodySchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid search request', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }
    const { query, object_types, limit, cursor } = parsed.data
    const result = await services.search.search(c.get('orbit'), {
      ...(query !== undefined ? { query } : {}),
      ...(object_types !== undefined ? { object_types } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    })
    return c.json(toEnvelope(c, serializeSearchPage(result.data), result, { omitNextLink: true }))
  })
}
