import { describe, it, expect } from 'vitest'
import { retry } from '../retries.js'
import { OrbitApiError } from '../errors.js'
import type { OrbitErrorShape } from '@orbit-ai/core'

describe('retry', () => {
  it('returns result on first success', async () => {
    const result = await retry(() => Promise.resolve(42), { maxRetries: 3 })
    expect(result).toBe(42)
  })

  it('retries on retryable OrbitApiError', async () => {
    let attempts = 0
    const retryableShape: OrbitErrorShape = {
      code: 'ADAPTER_UNAVAILABLE',
      message: 'temporarily unavailable',
      retryable: true,
    }

    const result = await retry(
      async () => {
        attempts += 1
        if (attempts < 3) {
          throw new OrbitApiError(retryableShape, 503)
        }
        return 'ok'
      },
      { maxRetries: 5 },
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  it('does not retry non-retryable OrbitApiError', async () => {
    let attempts = 0
    const nonRetryableShape: OrbitErrorShape = {
      code: 'VALIDATION_FAILED',
      message: 'bad input',
      retryable: false,
    }

    await expect(
      retry(
        async () => {
          attempts += 1
          throw new OrbitApiError(nonRetryableShape, 422)
        },
        { maxRetries: 3 },
      ),
    ).rejects.toThrow('bad input')

    expect(attempts).toBe(1)
  })

  it('does not retry non-OrbitApiError errors', async () => {
    let attempts = 0

    await expect(
      retry(
        async () => {
          attempts += 1
          throw new Error('generic error')
        },
        { maxRetries: 3 },
      ),
    ).rejects.toThrow('generic error')

    expect(attempts).toBe(1)
  })

  it('stops retrying after maxRetries', async () => {
    let attempts = 0
    const retryableShape: OrbitErrorShape = {
      code: 'ADAPTER_UNAVAILABLE',
      message: 'still unavailable',
      retryable: true,
    }

    await expect(
      retry(
        async () => {
          attempts += 1
          throw new OrbitApiError(retryableShape, 503)
        },
        { maxRetries: 2 },
      ),
    ).rejects.toThrow('still unavailable')

    // First attempt + 2 retries = 3 total
    expect(attempts).toBe(3)
  })
})
