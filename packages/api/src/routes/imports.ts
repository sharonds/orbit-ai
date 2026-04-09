import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { z } from 'zod'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'
import { paginationParams } from '../utils/pagination.js'

// Conservative allowlist of import sources the HTTP API accepts.
// The core service may support more, but we only expose vetted ones here.
// Adding a new source requires adding it to this allowlist AND confirming
// that the service-layer handler for it does not introduce an SSRF vector
// (e.g. a 'url' source would need URL validation here before hitting core).
const ImportSourceSchema = z.enum(['csv', 'json', 'inline'])

const CreateImportSchema = z.object({
  source: ImportSourceSchema,
  entity: z.string().min(1).max(64),
  rows: z.array(z.record(z.unknown())).optional(),
  file_id: z.string().min(1).max(128).optional(),
  options: z.record(z.unknown()).optional(),
})

export function registerImportRoutes(app: Hono, services: CoreServices) {
  // GET /v1/imports — list
  app.get('/v1/imports', requireScope('imports:read'), async (c) => {
    const { limit, cursor } = paginationParams(c)
    const service = services.imports as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    return c.json(toEnvelope(c, result.data, result))
  })

  // POST /v1/imports — create
  app.post('/v1/imports', requireScope('imports:write'), async (c) => {
    const body = await c.req.json()
    const parsed = CreateImportSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }
    const service = services.imports as any
    const created = await service.create(c.get('orbit'), parsed.data)
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
