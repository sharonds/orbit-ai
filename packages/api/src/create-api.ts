import { Hono } from 'hono'
import type { CreateApiOptions } from './config.js'
import { requestIdMiddleware } from './middleware/request-id.js'
import { versionMiddleware } from './middleware/version.js'
import { authMiddleware } from './middleware/auth.js'
import { tenantContextMiddleware } from './middleware/tenant-context.js'
import { orbitErrorHandler } from './middleware/error-handler.js'
import './context.js'

export function createApi(options: CreateApiOptions) {
  const app = new Hono()

  // Global error handler
  app.onError(orbitErrorHandler)

  // Global middleware
  app.use('*', requestIdMiddleware())

  // /v1/* middleware
  app.use('/v1/*', versionMiddleware(options.version))
  app.use('/v1/*', authMiddleware(options.adapter))
  app.use('/v1/*', tenantContextMiddleware(options.adapter))

  return app
}
