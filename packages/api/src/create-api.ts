import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createCoreServicesForRuntimeAdapter } from '@orbit-ai/core'
import type { CreateApiOptions } from './config.js'
import { requestIdMiddleware } from './middleware/request-id.js'
import { versionMiddleware } from './middleware/version.js'
import { authMiddleware } from './middleware/auth.js'
import { tenantContextMiddleware } from './middleware/tenant-context.js'
import { orbitErrorHandler } from './middleware/error-handler.js'
import { rateLimitMiddleware } from './middleware/rate-limit.js'
import { idempotencyMiddleware } from './middleware/idempotency.js'
import { registerHealthCheck, registerStatusRoute, registerOpenApiRoute } from './routes/health.js'
import { registerSearchRoutes } from './routes/search.js'
import { registerContextRoutes } from './routes/context.js'
import { registerPublicEntityRoutes } from './routes/entities.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerBootstrapRoutes } from './routes/bootstrap.js'
import { registerOrganizationRoutes } from './routes/organizations.js'
import { registerWorkflowRoutes } from './routes/workflows.js'
import { registerRelationshipRoutes } from './routes/relationships.js'
import { registerObjectRoutes } from './routes/objects.js'
import { registerWebhookRoutes } from './routes/webhooks.js'
import { registerImportRoutes } from './routes/imports.js'
import './context.js'

/**
 * Create an Orbit AI Hono app with the full middleware chain:
 * `requestId → version → bodyLimit → auth → tenantContext → rateLimit → idempotency → routes`.
 *
 * @security **Single-instance defaults**: by default this function uses
 * in-memory stores for both idempotency (`MemoryIdempotencyStore`) and
 * rate limiting. These are **single-instance only** — on multi-pod
 * deployments (Vercel, Cloudflare Workers, horizontal Kubernetes pods)
 * every instance has its own memory, which silently disables both
 * guards.
 *
 * For multi-instance deployments you MUST:
 * - Provide a custom `idempotencyStore` via `CreateApiOptions` (back it
 *   with Redis, Upstash, or the `idempotency_keys` DB table)
 * - Plan for a shared-store rate limiter (tracked as Phase 3 T12 —
 *   the default in-memory limiter remains the only option until then)
 *
 * For single-pod / serverless-with-sticky-sessions / local-dev, the
 * defaults are safe.
 */
export function createApi(options: CreateApiOptions) {
  const app = new Hono()

  // Global error handler
  app.onError(orbitErrorHandler)

  // Global middleware
  app.use('*', requestIdMiddleware())

  // Health check + OpenAPI spec — no auth required
  registerHealthCheck(app)
  registerOpenApiRoute(app, options.version)

  // /v1/* middleware
  app.use('/v1/*', versionMiddleware(options.version))
  app.use('/v1/*', bodyLimit({
    maxSize: options.maxRequestBodySize ?? 1_048_576,
    onError: (c) => {
      return c.json(
        {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds the maximum allowed size',
            request_id: c.get('requestId'),
            doc_url: 'https://orbit-ai.dev/docs/errors#payload_too_large',
            hint: `Maximum body size is ${options.maxRequestBodySize ?? 1_048_576} bytes`,
            retryable: false,
          },
        },
        413,
      )
    },
  }))
  app.use('/v1/*', authMiddleware(options.adapter))
  app.use('/v1/*', tenantContextMiddleware(options.adapter))
  app.use('/v1/*', rateLimitMiddleware())
  app.use('/v1/*', idempotencyMiddleware(options.idempotencyStore ? { store: options.idempotencyStore } : {}))

  // Core services — use pre-built services if provided, otherwise create
  // from the runtime adapter. Schema migrations require an explicit
  // migrationAuthority option; request paths never recover it from the adapter.
  const services = options.services
    ?? createCoreServicesForRuntimeAdapter(options.adapter, {
      ...(options.migrationAuthority ? { migrationAuthority: options.migrationAuthority } : {}),
    })

  // Authenticated routes (registered after auth middleware)
  registerStatusRoute(app)
  registerSearchRoutes(app, services)
  registerContextRoutes(app, services)

  // Bootstrap routes (platform:bootstrap scope)
  registerBootstrapRoutes(app, services)

  // Organization routes (current org)
  registerOrganizationRoutes(app, services)

  // Admin routes (admin:* scope)
  registerAdminRoutes(app, services)

  // Dedicated webhook routes (before generic entities to avoid conflicts)
  registerWebhookRoutes(app, services)

  // Dedicated import routes
  registerImportRoutes(app, services)

  // Workflow routes (deal moves, sequence enrollment, tag attach/detach, activity log)
  // Register BEFORE generic entities so /v1/deals/pipeline, /v1/deals/stats
  // are matched before /v1/deals/:id
  registerWorkflowRoutes(app, services)

  // Relationship routes (contact timeline, company contacts, etc.)
  registerRelationshipRoutes(app, services)

  // Schema / object routes
  registerObjectRoutes(app, services)

  // Generic public entity CRUD (Wave 1 + Wave 2)
  registerPublicEntityRoutes(app, services)

  return app
}
