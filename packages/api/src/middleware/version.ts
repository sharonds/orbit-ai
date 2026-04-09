import type { MiddlewareHandler } from 'hono'
import '../context.js'

export function versionMiddleware(defaultVersion: string): MiddlewareHandler {
  return async (c, next) => {
    const version = c.req.header('orbit-version') ?? defaultVersion
    c.set('orbitVersion', version)
    await next()
  }
}
