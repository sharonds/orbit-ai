import type { MiddlewareHandler } from 'hono'
import '../context.js'

const VALID_REQUEST_ID = /^[\w-]{1,128}$/

export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const existing = c.req.header('x-request-id')
    const requestId =
      existing && VALID_REQUEST_ID.test(existing)
        ? existing
        : `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`
    c.set('requestId', requestId)
    c.header('x-request-id', requestId)
    await next()
  }
}
