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
})
