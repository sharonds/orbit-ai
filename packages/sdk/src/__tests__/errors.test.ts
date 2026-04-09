import { describe, it, expect } from 'vitest'
import { OrbitApiError } from '../errors.js'
import type { OrbitErrorShape } from '@orbit-ai/core'

describe('OrbitApiError', () => {
  const shape: OrbitErrorShape = {
    code: 'VALIDATION_FAILED',
    message: 'Name is required',
    field: 'name',
    retryable: false,
  }

  it('constructs from error shape and status', () => {
    const err = new OrbitApiError(shape, 422)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('OrbitApiError')
  })

  it('exposes status', () => {
    const err = new OrbitApiError(shape, 422)
    expect(err.status).toBe(422)
  })

  it('exposes error shape properties', () => {
    const err = new OrbitApiError(shape, 422)
    expect(err.error.code).toBe('VALIDATION_FAILED')
    expect(err.error.field).toBe('name')
    expect(err.error.retryable).toBe(false)
  })

  it('exposes message from shape', () => {
    const err = new OrbitApiError(shape, 422)
    expect(err.message).toBe('Name is required')
  })

  describe('fromResponse', () => {
    it('parses JSON error response', async () => {
      const response = new Response(
        JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'Bad input', retryable: false } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      )
      const err = await OrbitApiError.fromResponse(response)
      expect(err).toBeInstanceOf(OrbitApiError)
      expect(err.status).toBe(400)
      expect(err.error.code).toBe('VALIDATION_FAILED')
      expect(err.error.message).toBe('Bad input')
    })

    it('handles non-JSON error responses gracefully', async () => {
      const response = new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      })
      const err = await OrbitApiError.fromResponse(response)
      expect(err.status).toBe(502)
      expect(err.error.code).toBe('INTERNAL_ERROR')
      expect(err.error.retryable).toBe(true)
    })

    it('handles empty JSON body without error field', async () => {
      const response = new Response(JSON.stringify({}), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
      const err = await OrbitApiError.fromResponse(response)
      expect(err.status).toBe(500)
      expect(err.error.code).toBe('INTERNAL_ERROR')
      expect(err.error.retryable).toBe(true)
    })
  })
})
