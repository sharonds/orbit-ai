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
const MAX_STORE_SIZE = 10_000

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
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
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

    // Include orgId in store key to prevent cross-tenant response replay
    const orgId = c.get('orbit')?.orgId ?? 'unknown'
    const routeKey = `${orgId}:${c.req.method}:${c.req.path}:${key}`
    const existing = store.get(routeKey)

    // Parse JSON body for hash comparison. We call c.req.json() here — the same
    // method downstream handlers use — because Hono's HonoRequest caches the
    // parsed result internally. This guarantees that downstream c.req.json()
    // returns the cached value rather than re-reading the body stream, which is
    // critical for Cloudflare Workers and Vercel Edge runtimes where the
    // underlying ReadableStream can only be consumed once.
    let bodyText = ''
    try {
      const parsed = await c.req.json()
      bodyText = JSON.stringify(parsed)
    } catch {
      // no body or not JSON — that's fine
    }
    const currentHash = bodyText || 'null'

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

    // Evict oldest entry if store exceeds max size.
    // Map preserves insertion order and entries are never re-inserted,
    // so the first key is always the oldest.
    if (store.size > MAX_STORE_SIZE) {
      const oldest = store.keys().next().value
      if (oldest) store.delete(oldest)
    }

    // Echo the idempotency key in the response
    c.header('idempotency-key', key)
  }
}
