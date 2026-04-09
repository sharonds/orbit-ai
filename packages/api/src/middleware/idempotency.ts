import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

export interface StoredResponse {
  status: number
  body: string
  requestHash: string
  createdAt: number
}

/**
 * Interface for idempotency key storage. Implementations can be in-memory
 * (default, single-instance only), Redis-backed, or DB-backed (see the
 * idempotency_keys table in @orbit-ai/core for the schema).
 *
 * For multi-instance deployments you MUST provide a custom implementation
 * via CreateApiOptions.idempotencyStore — the default MemoryIdempotencyStore
 * is process-local and will silently fail to replay across instances.
 */
export interface IdempotencyStore {
  get(key: string): Promise<StoredResponse | undefined>
  set(key: string, value: StoredResponse): Promise<void>
  evictExpired(): Promise<void>
}

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_STORE_SIZE = 10_000

/**
 * Default in-memory idempotency store. Single-instance only — use a custom
 * IdempotencyStore (e.g. backed by Redis or the idempotency_keys DB table)
 * for multi-instance deployments.
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, StoredResponse>()

  async get(key: string): Promise<StoredResponse | undefined> {
    return this.store.get(key)
  }

  async set(key: string, value: StoredResponse): Promise<void> {
    this.store.set(key, value)
    if (this.store.size > MAX_STORE_SIZE) {
      const oldest = this.store.keys().next().value
      if (oldest) this.store.delete(oldest)
    }
  }

  async evictExpired(): Promise<void> {
    const now = Date.now()
    for (const [k, v] of this.store) {
      if (now - v.createdAt > TTL_MS) this.store.delete(k)
    }
  }

  /** Exposed for tests only. */
  _reset(): void {
    this.store.clear()
  }
}

// Shared singleton used when no custom store is provided (preserves current behavior)
const defaultStore = new MemoryIdempotencyStore()

/** Exposed for tests only — resets the default shared store. */
export function _resetIdempotencyStore(): void {
  defaultStore._reset()
}

export interface IdempotencyMiddlewareOptions {
  store?: IdempotencyStore
}

export function idempotencyMiddleware(
  options: IdempotencyMiddlewareOptions = {},
): MiddlewareHandler {
  const store = options.store ?? defaultStore

  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      await next()
      return
    }

    // Bootstrap exemption
    if (c.req.path.startsWith('/v1/bootstrap/')) {
      await next()
      return
    }

    const key = c.req.header('idempotency-key')
    if (!key) {
      await next()
      return
    }

    await store.evictExpired()

    const orgId = c.get('orbit')?.orgId ?? 'unknown'
    const routeKey = `${orgId}:${c.req.method}:${c.req.path}:${key}`
    const existing = await store.get(routeKey)

    let bodyText = ''
    try {
      const parsed = await c.req.json()
      bodyText = JSON.stringify(parsed)
    } catch {
      // no body or not JSON
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
      c.header('idempotency-key', key)
      c.header('x-idempotent-replayed', 'true')
      return c.json(
        JSON.parse(existing.body),
        existing.status as Parameters<typeof c.json>[1],
      )
    }

    await next()

    const cloned = c.res.clone()
    const responseBody = await cloned.text()
    await store.set(routeKey, {
      status: c.res.status,
      body: responseBody,
      requestHash: currentHash,
      createdAt: Date.now(),
    })

    c.header('idempotency-key', key)
  }
}
