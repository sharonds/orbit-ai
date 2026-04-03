import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requireScope } from '../scopes.js'
import { toEnvelope, toError } from '../responses.js'
import { z } from 'zod'

const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const CreateApiKeySchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1),
  expires_at: z.string().datetime().optional(),
})

export function registerBootstrapRoutes(app: Hono, services: CoreServices) {
  // POST /v1/bootstrap/organizations
  app.post('/v1/bootstrap/organizations', requireScope('platform:bootstrap'), async (c) => {
    const body = await c.req.json()
    const parsed = CreateOrganizationSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }

    const service = services.system.organizations as any
    if (typeof service.create !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap organization creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, result), 201)
  })

  // POST /v1/bootstrap/api-keys
  app.post('/v1/bootstrap/api-keys', requireScope('platform:bootstrap'), async (c) => {
    const body = await c.req.json()
    const parsed = CreateApiKeySchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }

    const service = services.system.apiKeys as any
    if (typeof service.create !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap API key creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, result), 201)
  })
}
