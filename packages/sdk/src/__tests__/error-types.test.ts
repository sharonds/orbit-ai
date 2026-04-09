import { describe, it, expect } from 'vitest'
import { OrbitApiError, ORBIT_ERROR_CODES } from '../index.js'
import type { OrbitErrorCode } from '../index.js'

describe('OrbitApiError .code getter', () => {
  it('exposes .code as a direct property matching .error.code', () => {
    const err = new OrbitApiError(
      {
        code: 'RATE_LIMITED',
        message: 'too many requests',
        retryable: true,
      },
      429,
    )
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.error.code).toBe('RATE_LIMITED') // legacy path still works
  })

  it('exposes .message inherited from Error', () => {
    const err = new OrbitApiError(
      { code: 'RESOURCE_NOT_FOUND', message: 'contact not found', retryable: false },
      404,
    )
    expect(err.message).toBe('contact not found')
  })

  it('TypeScript narrows on .code without reaching into .error', () => {
    const err = new OrbitApiError(
      { code: 'AUTH_INVALID_API_KEY', message: 'bad key', retryable: false },
      401,
    )
    // Compile-time check: err.code is OrbitErrorCode
    const code: OrbitErrorCode = err.code
    expect(code).toBe('AUTH_INVALID_API_KEY')
  })
})

describe('@orbit-ai/sdk index exports', () => {
  it('re-exports ORBIT_ERROR_CODES from core', () => {
    expect(ORBIT_ERROR_CODES).toBeDefined()
    expect(Array.isArray(ORBIT_ERROR_CODES)).toBe(true)
    expect(ORBIT_ERROR_CODES).toContain('RATE_LIMITED')
    expect(ORBIT_ERROR_CODES).toContain('RESOURCE_NOT_FOUND')
  })
})
