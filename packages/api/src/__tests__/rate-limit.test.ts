import { describe, it, expect } from 'vitest'

describe('rate limit middleware', () => {
  it.todo('adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers')
  it.todo('returns 429 with Retry-After when rate limited')
  it.todo('rate limits are per-API-key')
  it.todo('different API keys have independent rate limits')
})
