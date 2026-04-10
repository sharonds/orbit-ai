import { describe, it, expect, vi } from 'vitest'
import { withBoundedRetry, isRetryableError } from './retry.js'

// Use baseDelayMs: 0 and jitter: false throughout to avoid real delays in tests.
// This avoids fake-timer races with vitest's async promise scheduling.

describe('withBoundedRetry', () => {
  it('succeeds on first attempt — fn called exactly once', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 status error — fn called maxAttempts times, then throws', async () => {
    const err = Object.assign(new Error('Request failed'), { status: 429 })
    const fn = vi.fn().mockImplementation(() => Promise.reject(err))

    await expect(
      withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('Request failed')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('retries on ECONNREFUSED — fn called maxAttempts times, then throws', async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    const fn = vi.fn().mockImplementation(() => Promise.reject(err))

    await expect(
      withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('ECONNREFUSED')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does NOT retry on 400 Bad Request — fn called once and throws immediately', async () => {
    const err = Object.assign(new Error('Bad Request'), { status: 400 })
    const fn = vi.fn().mockImplementation(() => Promise.reject(err))

    await expect(
      withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('Bad Request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 401 Unauthorized — fn called once and throws immediately', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    const fn = vi.fn().mockImplementation(() => Promise.reject(err))

    await expect(
      withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('Unauthorized')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 404 Not Found — fn called once and throws immediately', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 })
    const fn = vi.fn().mockImplementation(() => Promise.reject(err))

    await expect(
      withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('Not Found')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns result when fn succeeds after one failure', async () => {
    const err = Object.assign(new Error('Service Unavailable'), { status: 503 })
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(err))
      .mockResolvedValueOnce('recovered')

    const result = await withBoundedRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('respects maxAttempts option', async () => {
    const err = Object.assign(new Error('Bad Gateway'), { status: 502 })
    const fn = vi.fn().mockImplementation(() => Promise.reject(err))

    await expect(
      withBoundedRetry(fn, { maxAttempts: 5, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow('Bad Gateway')
    expect(fn).toHaveBeenCalledTimes(5)
  })
})

describe('isRetryableError', () => {
  it('returns true for 429 status on error object', () => {
    const err = Object.assign(new Error('Too Many Requests'), { status: 429 })
    expect(isRetryableError(err)).toBe(true)
  })

  it('returns true for 500 status on error object', () => {
    const err = Object.assign(new Error('Internal Server Error'), { status: 500 })
    expect(isRetryableError(err)).toBe(true)
  })

  it('returns true for 502 status on error object', () => {
    const err = Object.assign(new Error('Bad Gateway'), { status: 502 })
    expect(isRetryableError(err)).toBe(true)
  })

  it('returns true for 503 status on error object', () => {
    const err = Object.assign(new Error('Service Unavailable'), { status: 503 })
    expect(isRetryableError(err)).toBe(true)
  })

  it('returns true for 429 via statusCode property', () => {
    const err = Object.assign(new Error('Rate limit'), { statusCode: 429 })
    expect(isRetryableError(err)).toBe(true)
  })

  it('returns false for 400 status', () => {
    const err = Object.assign(new Error('Bad Request'), { status: 400 })
    expect(isRetryableError(err)).toBe(false)
  })

  it('returns false for 401 status', () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    expect(isRetryableError(err)).toBe(false)
  })

  it('returns false for 404 status', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 })
    expect(isRetryableError(err)).toBe(false)
  })

  it('returns true for ECONNREFUSED in message', () => {
    expect(isRetryableError(new Error('connect ECONNREFUSED 127.0.0.1:3000'))).toBe(true)
  })

  it('returns true for ETIMEDOUT in message', () => {
    expect(isRetryableError(new Error('request ETIMEDOUT'))).toBe(true)
  })

  it('returns true for ECONNRESET in message', () => {
    expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true)
  })

  it('returns true for ENOTFOUND in message', () => {
    expect(isRetryableError(new Error('getaddrinfo ENOTFOUND api.example.com'))).toBe(true)
  })

  it('returns false for null', () => {
    expect(isRetryableError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isRetryableError(undefined)).toBe(false)
  })

  it('returns false for plain string', () => {
    expect(isRetryableError('some error string')).toBe(false)
  })

  it('returns true for 503 in error message text', () => {
    expect(isRetryableError(new Error('HTTP 503 response received'))).toBe(true)
  })
})
