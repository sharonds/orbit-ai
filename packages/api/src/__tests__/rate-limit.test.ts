import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import type { OrbitAuthContext } from '@orbit-ai/core'
import { rateLimitMiddleware, _resetRateLimitBuckets } from '../middleware/rate-limit.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import '../context.js'

function createApp(limit = 5) {
  const app = new Hono()
  app.onError(orbitErrorHandler)
  app.use('*', requestIdMiddleware())

  // Fake auth context so rate limiter has an apiKeyId
  app.use('*', async (c, next) => {
    const keyId = c.req.header('x-test-key-id') ?? 'key_default'
    c.set('orbit', {
      orgId: 'org_001',
      apiKeyId: keyId,
      scopes: ['*'],
    } as OrbitAuthContext)
    await next()
  })

  app.use('*', rateLimitMiddleware({ limit, windowMs: 60_000 }))
  app.get('/v1/contacts', (c) => c.json({ data: [] }))

  return app
}

describe('rate limit middleware', () => {
  beforeEach(() => {
    _resetRateLimitBuckets()
  })

  it('adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers', async () => {
    const app = createApp(10)
    const res = await app.request('/v1/contacts')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-ratelimit-limit')).toBe('10')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('9')
    expect(res.headers.get('x-ratelimit-reset')).toBeTruthy()
  })

  it('returns 429 with Retry-After when rate limited', async () => {
    const app = createApp(2)

    // Use up quota
    await app.request('/v1/contacts')
    await app.request('/v1/contacts')

    // Third request should be rate limited
    const res = await app.request('/v1/contacts')
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeTruthy()
    const body = (await res.json()) as { error: { code: string; retryable: boolean } }
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(body.error.retryable).toBe(true)
  })

  it('rate limits are per-API-key', async () => {
    const app = createApp(2)

    // Exhaust quota for key_a
    await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_a' } })
    await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_a' } })

    const limited = await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_a' } })
    expect(limited.status).toBe(429)

    // key_b should still have quota
    const ok = await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_b' } })
    expect(ok.status).toBe(200)
  })

  it('different API keys have independent rate limits', async () => {
    const app = createApp(3)

    // Use 2 from key_a
    await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_a' } })
    await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_a' } })

    // key_a has 1 left, key_b has 3
    const resA = await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_a' } })
    expect(resA.status).toBe(200)
    expect(resA.headers.get('x-ratelimit-remaining')).toBe('0')

    const resB = await app.request('/v1/contacts', { headers: { 'x-test-key-id': 'key_b' } })
    expect(resB.status).toBe(200)
    expect(resB.headers.get('x-ratelimit-remaining')).toBe('2')
  })
})
