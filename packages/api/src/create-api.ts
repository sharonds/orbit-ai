import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createCoreServices, type StorageAdapter } from '@orbit-ai/core'
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
  // from adapter. RuntimeApiAdapter is a subset of StorageAdapter;
  // createCoreServices only uses query/runtime methods at request time,
  // never migrate/runWithMigrationAuthority, so the cast is safe.
  const services = options.services
    ?? createCoreServices(options.adapter as unknown as StorageAdapter)

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
