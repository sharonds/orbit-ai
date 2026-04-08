import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { paginationParams } from '../utils/pagination.js'

describe('paginationParams', () => {
  function makeCtx(query: Record<string, string>) {
    const app = new Hono()
    let capturedCtx: any
    app.get('/test', (c) => {
      capturedCtx = c
      return c.text('ok')
    })
    const searchParams = new URLSearchParams(query)
    const req = new Request(`http://localhost/test?${searchParams.toString()}`)
    app.fetch(req)
    return capturedCtx
  }

  it('returns undefined limit when no query param', () => {
    const c = makeCtx({})
    const result = paginationParams(c)
    expect(result).toEqual({ limit: undefined, cursor: undefined })
  })

  it('returns cursor when provided without limit', () => {
    const c = makeCtx({ cursor: 'abc123' })
    const result = paginationParams(c)
    expect(result).toEqual({ limit: undefined, cursor: 'abc123' })
  })

  it('parses valid limit', () => {
    const c = makeCtx({ limit: '25' })
    const result = paginationParams(c)
    expect(result).toEqual({ limit: 25, cursor: undefined })
  })

  it('parses valid limit with cursor', () => {
    const c = makeCtx({ limit: '50', cursor: 'xyz' })
    const result = paginationParams(c)
    expect(result).toEqual({ limit: 50, cursor: 'xyz' })
  })

  it('throws on NaN limit', () => {
    const c = makeCtx({ limit: 'abc' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on zero limit', () => {
    const c = makeCtx({ limit: '0' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on negative limit', () => {
    const c = makeCtx({ limit: '-5' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on limit > 100', () => {
    const c = makeCtx({ limit: '101' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on float limit', () => {
    const c = makeCtx({ limit: '3.14' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('accepts limit=1 (minimum)', () => {
    const c = makeCtx({ limit: '1' })
    const result = paginationParams(c)
    expect(result.limit).toBe(1)
  })

  it('accepts limit=100 (maximum)', () => {
    const c = makeCtx({ limit: '100' })
    const result = paginationParams(c)
    expect(result.limit).toBe(100)
  })
})
