import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()
const DEFAULT_LIMIT = 100 // requests per window
const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_BUCKETS = 10_000

/** Expose the store for testing only. */
export function _resetRateLimitBuckets(): void {
  buckets.clear()
}

/** Expose MAX_BUCKETS for testing only. */
export const _MAX_BUCKETS = MAX_BUCKETS

/** Seed buckets with dummy entries for testing only. */
export function _seedBucketsForTest(count: number): void {
  for (let i = 0; i < count; i++) {
    buckets.set(`__seed_${i}`, { tokens: 100, lastRefill: Date.now() })
  }
}

export interface RateLimitOptions {
  /** Max requests per window. Defaults to 100. */
  limit?: number
  /** Window duration in ms. Defaults to 60 000 (1 minute). */
  windowMs?: number
}

export function rateLimitMiddleware(opts?: RateLimitOptions): MiddlewareHandler {
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const windowMs = opts?.windowMs ?? WINDOW_MS

  return async (c, next) => {
    const ctx = c.get('orbit')
    const key = ctx?.apiKeyId ?? 'anonymous'

    const now = Date.now()
    let bucket = buckets.get(key)
    if (!bucket || now - bucket.lastRefill >= windowMs) {
      bucket = { tokens: limit, lastRefill: now }
      buckets.set(key, bucket)

      // Evict oldest bucket if at capacity (O(1) via Map insertion order)
      if (buckets.size > MAX_BUCKETS) {
        const firstKey = buckets.keys().next().value
        if (firstKey !== undefined) buckets.delete(firstKey)
      }
    }

    bucket.tokens -= 1

    c.header('x-ratelimit-limit', String(limit))
    c.header('x-ratelimit-remaining', String(Math.max(0, bucket.tokens)))
    c.header('x-ratelimit-reset', String(Math.ceil((bucket.lastRefill + windowMs) / 1000)))

    if (bucket.tokens < 0) {
      const retryAfter = Math.ceil((bucket.lastRefill + windowMs - now) / 1000)
      c.header('retry-after', String(retryAfter))
      throw new OrbitError({
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        retryable: true,
      })
    }

    await next()
  }
}
