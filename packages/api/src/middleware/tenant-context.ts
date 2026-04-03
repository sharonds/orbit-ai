import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import type { RuntimeApiAdapter } from '../config.js'
import '../context.js'

/**
 * Tenant-context middleware: wraps request handling in adapter.withTenantContext
 * so that all downstream DB operations are scoped to the authenticated org.
 *
 * Bypasses `/v1/bootstrap/` paths (org creation before auth exists).
 */
export function tenantContextMiddleware(
  adapter: RuntimeApiAdapter,
): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path

    // Bypass bootstrap routes
    if (path.startsWith('/v1/bootstrap/')) {
      await next()
      return
    }

    const ctx = c.get('orbit')
    if (!ctx?.orgId) {
      throw new OrbitError({
        code: 'AUTH_CONTEXT_REQUIRED',
        message: 'Tenant context is required for this endpoint',
        hint: 'Authenticate with a valid API key.',
      })
    }

    await adapter.withTenantContext(ctx, async () => {
      await next()
    })
  }
}
