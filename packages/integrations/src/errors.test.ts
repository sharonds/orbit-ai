import { describe, it, expect } from 'vitest'
import {
  isIntegrationError,
  createIntegrationError,
  toIntegrationError,
  fromIntegrationError,
} from './errors.js'
import type { IntegrationError } from './errors.js'

describe('isIntegrationError', () => {
  it('returns true for a valid IntegrationError', () => {
    const err: IntegrationError = createIntegrationError('PROVIDER_ERROR', 'Something went wrong')
    expect(isIntegrationError(err)).toBe(true)
  })

  it('returns false for a plain Error', () => {
    expect(isIntegrationError(new Error('oops'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isIntegrationError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isIntegrationError(undefined)).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isIntegrationError('some error string')).toBe(false)
  })
})

describe('createIntegrationError', () => {
  it('creates an IntegrationError with required fields', () => {
    const err = createIntegrationError('AUTH_EXPIRED', 'Token expired')
    expect(err._type).toBe('IntegrationError')
    expect(err.code).toBe('AUTH_EXPIRED')
    expect(err.message).toBe('Token expired')
    expect(err.provider).toBeUndefined()
    expect(err.cause).toBeUndefined()
  })

  it('creates an IntegrationError with optional provider and cause', () => {
    const cause = new Error('original')
    const err = createIntegrationError('RATE_LIMITED', 'Too many requests', {
      provider: 'gmail',
      cause,
    })
    expect(err.provider).toBe('gmail')
    expect(err.cause).toBe(cause)
  })

  it('omits provider and cause keys when not provided', () => {
    const err = createIntegrationError('NOT_FOUND', 'Resource not found')
    expect('provider' in err).toBe(false)
    expect('cause' in err).toBe(false)
  })
})

describe('toIntegrationError', () => {
  it('maps a plain Error to PROVIDER_ERROR', () => {
    const err = toIntegrationError(new Error('Something failed'))
    expect(err.code).toBe('PROVIDER_ERROR')
    expect(err.message).toBe('Something failed')
  })

  it('maps an Error containing "401" to AUTH_EXPIRED', () => {
    const err = toIntegrationError(new Error('HTTP 401 Unauthorized'))
    expect(err.code).toBe('AUTH_EXPIRED')
  })

  it('maps an Error containing "unauthorized" to AUTH_EXPIRED', () => {
    const err = toIntegrationError(new Error('Request unauthorized'))
    expect(err.code).toBe('AUTH_EXPIRED')
  })

  it('maps an Error containing "token expired" to AUTH_EXPIRED', () => {
    const err = toIntegrationError(new Error('The token expired'))
    expect(err.code).toBe('AUTH_EXPIRED')
  })

  it('maps an Error containing "429" to RATE_LIMITED', () => {
    const err = toIntegrationError(new Error('HTTP 429 Too Many Requests'))
    expect(err.code).toBe('RATE_LIMITED')
  })

  it('maps an Error containing "rate limit" to RATE_LIMITED', () => {
    const err = toIntegrationError(new Error('Rate limit exceeded'))
    expect(err.code).toBe('RATE_LIMITED')
  })

  it('maps an Error containing "404" to NOT_FOUND', () => {
    const err = toIntegrationError(new Error('HTTP 404 Not Found'))
    expect(err.code).toBe('NOT_FOUND')
  })

  it('maps an Error containing "not found" to NOT_FOUND', () => {
    const err = toIntegrationError(new Error('Resource not found'))
    expect(err.code).toBe('NOT_FOUND')
  })

  it('maps an Error containing "409" to CONFLICT', () => {
    const err = toIntegrationError(new Error('HTTP 409 Conflict'))
    expect(err.code).toBe('CONFLICT')
  })

  it('maps an Error containing "conflict" to CONFLICT', () => {
    const err = toIntegrationError(new Error('Duplicate conflict'))
    expect(err.code).toBe('CONFLICT')
  })

  it('passes through an existing IntegrationError unchanged', () => {
    const original = createIntegrationError('WEBHOOK_SIGNATURE_INVALID', 'Bad sig', {
      provider: 'stripe',
    })
    const result = toIntegrationError(original)
    expect(result).toBe(original)
  })

  it('attaches provider when provided', () => {
    const err = toIntegrationError(new Error('fail'), 'gmail')
    expect(err.provider).toBe('gmail')
  })

  it('converts a non-Error thrown value to PROVIDER_ERROR', () => {
    const err = toIntegrationError('just a string')
    expect(err.code).toBe('PROVIDER_ERROR')
    expect(err.message).toBe('just a string')
  })
})

describe('fromIntegrationError', () => {
  const base = createIntegrationError('AUTH_EXPIRED', 'Token is expired', { provider: 'gmail' })

  it('returns a string with error code for cli target', () => {
    const result = fromIntegrationError(base, 'cli')
    expect(typeof result).toBe('string')
    expect(result as string).toContain('AUTH_EXPIRED')
    expect(result as string).toContain('Token is expired')
  })

  it('returns an object with type and error for mcp target', () => {
    const result = fromIntegrationError(base, 'mcp') as {
      type: string
      error: { code: string; message: string }
    }
    expect(result.type).toBe('error')
    expect(result.error.code).toBe('AUTH_EXPIRED')
    expect(result.error.message).toBe('Token is expired')
  })

  it('returns an object with error property for api target', () => {
    const result = fromIntegrationError(base, 'api') as {
      error: { code: string; message: string }
    }
    expect(result.error.code).toBe('AUTH_EXPIRED')
    expect(result.error.message).toBe('Token is expired')
  })
})
