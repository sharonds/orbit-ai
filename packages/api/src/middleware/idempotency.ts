import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

interface StoredResponse {
  status: number
  body: string
  requestHash: string
  createdAt: number
}

const store = new Map<string, StoredResponse>()
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function hashBody(body: unknown): string {
  return JSON.stringify(body ?? null)
}

/** Evict entries older than TTL. */
function evictExpired(): void {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now - v.createdAt > TTL_MS) store.delete(k)
  }
}

/** Expose the store for testing only. */
export function _resetIdempotencyStore(): void {
  store.clear()
}

export function idempotencyMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Only apply to mutating requests
    if (c.req.method === 'GET') {
      await next()
      return
    }

    const key = c.req.header('idempotency-key')
    if (!key) {
      await next()
      return
    }

    // Clean expired entries
    evictExpired()

    const routeKey = `${c.req.method}:${c.req.path}:${key}`
    const existing = store.get(routeKey)

    // Parse current body for hash comparison
    let currentBody: unknown = null
    try {
      currentBody = await c.req.json()
    } catch {
      // no body or not JSON — that's fine
    }
    const currentHash = hashBody(currentBody)

    if (existing) {
      if (currentHash !== existing.requestHash) {
        throw new OrbitError({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key already used with different request body',
          retryable: false,
        })
      }
      // Replay stored response
      c.header('idempotency-key', key)
      c.header('x-idempotent-replayed', 'true')
      return c.json(
        JSON.parse(existing.body),
        existing.status as Parameters<typeof c.json>[1],
      )
    }

    // Process the request
    await next()

    // Capture the response body for future replay.
    // Clone the response so we can read its body without consuming it.
    const cloned = c.res.clone()
    const responseBody = await cloned.text()

    store.set(routeKey, {
      status: c.res.status,
      body: responseBody,
      requestHash: currentHash,
      createdAt: Date.now(),
    })

    // Echo the idempotency key in the response
    c.header('idempotency-key', key)
  }
}
