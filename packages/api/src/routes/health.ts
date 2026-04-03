import type { Hono } from 'hono'
import { toEnvelope } from '../responses.js'

/** Register GET /health — call BEFORE auth middleware. */
export function registerHealthCheck(app: Hono) {
  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() }),
  )
}

/** Register GET /v1/status — call AFTER auth middleware so it requires auth. */
export function registerStatusRoute(app: Hono) {
  app.get('/v1/status', (c) => {
    return c.json(
      toEnvelope(c, {
        status: 'ok',
        version: c.get('orbitVersion'),
        timestamp: new Date().toISOString(),
      }),
    )
  })
}
