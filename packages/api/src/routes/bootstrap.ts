import type { Context, Hono } from 'hono'
import type { CoreServices, OrbitAuthContext } from '@orbit-ai/core'
import { isOrbitId } from '@orbit-ai/core'
import { requireScope } from '../scopes.js'
import { toEnvelope, toError, sanitizeOrganizationRead, sanitizeApiKeyRead } from '../responses.js'
import { z } from 'zod'

/**
 * Hono context shape for routes that have already passed the auth
 * middleware. The `orbit` variable carries the authenticated tenant
 * context. Replaces ad-hoc `c.get('orbit')` accesses that previously
 * inferred as `any`.
 */
type BootstrapContext = Context<{ Variables: { orbit: OrbitAuthContext } }>

/**
 * The system admin services in `CoreServices.system` are typed as
 * `AdminEntityService<TRecord>` which only exposes `list` and `get`.
 * Bootstrap routes need a `create` method, but that capability is
 * intentionally optional at the type level so non-bootstrap-capable
 * admin services don't have to provide a stub. The optional shape
 * lets bootstrap.ts check for `create` at runtime and 501 cleanly
 * when an environment hasn't wired the bootstrap path.
 */
interface BootstrapAdminCapability<TInput, TRecord> {
  create?: (ctx: OrbitAuthContext, input: TInput) => Promise<TRecord>
}

const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const CreateApiKeySchema = z.object({
  organization_id: z.string().refine(
    (v) => isOrbitId(v, 'organization'),
    { message: 'Must be a valid Orbit organization ID (org_...)' },
  ),
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1),
  expires_at: z.string().datetime().optional(),
})

type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>
type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>

export function registerBootstrapRoutes(app: Hono, services: CoreServices) {
  // POST /v1/bootstrap/organizations
  app.post('/v1/bootstrap/organizations', requireScope('platform:bootstrap'), async (c: BootstrapContext) => {
    const body = await c.req.json()
    const parsed = CreateOrganizationSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }

    const service = services.system.organizations as typeof services.system.organizations &
      BootstrapAdminCapability<CreateOrganizationInput, unknown>
    if (!service.create) {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap organization creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, sanitizeOrganizationRead(result)), 201)
  })

  // POST /v1/bootstrap/api-keys
  app.post('/v1/bootstrap/api-keys', requireScope('platform:bootstrap'), async (c: BootstrapContext) => {
    const body = await c.req.json()
    const parsed = CreateApiKeySchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }

    const service = services.system.apiKeys as typeof services.system.apiKeys &
      BootstrapAdminCapability<CreateApiKeyInput, unknown>
    if (!service.create) {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap API key creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, sanitizeApiKeyRead(result)), 201)
  })
}
