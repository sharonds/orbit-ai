import { Hono } from 'hono'
import { createCoreServices, type StorageAdapter } from '@orbit-ai/core'
import type { CreateApiOptions } from './config.js'
import { requestIdMiddleware } from './middleware/request-id.js'
import { versionMiddleware } from './middleware/version.js'
import { authMiddleware } from './middleware/auth.js'
import { tenantContextMiddleware } from './middleware/tenant-context.js'
import { orbitErrorHandler } from './middleware/error-handler.js'
import { registerHealthCheck, registerStatusRoute } from './routes/health.js'
import { registerSearchRoutes } from './routes/search.js'
import { registerContextRoutes } from './routes/context.js'
import './context.js'

export function createApi(options: CreateApiOptions) {
  const app = new Hono()

  // Global error handler
  app.onError(orbitErrorHandler)

  // Global middleware
  app.use('*', requestIdMiddleware())

  // Health check — no auth required
  registerHealthCheck(app)

  // /v1/* middleware
  app.use('/v1/*', versionMiddleware(options.version))
  app.use('/v1/*', authMiddleware(options.adapter))
  app.use('/v1/*', tenantContextMiddleware(options.adapter))

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

  return app
}
