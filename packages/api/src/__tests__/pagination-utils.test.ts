import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { paginationParams } from '../utils/pagination.js'

describe('paginationParams', () => {
  async function makeCtx(query: Record<string, string>) {
    const app = new Hono()
    let capturedCtx: any
    app.get('/test', (c) => {
      capturedCtx = c
      return c.text('ok')
    })
    const searchParams = new URLSearchParams(query)
    const req = new Request(`http://localhost/test?${searchParams.toString()}`)
    await app.fetch(req)
    return capturedCtx
  }

  it('returns undefined limit when no query param', async () => {
    const c = await makeCtx({})
    const result = paginationParams(c)
    expect(result).toEqual({ limit: undefined, cursor: undefined })
  })

  it('returns cursor when provided without limit', async () => {
    const c = await makeCtx({ cursor: 'abc123' })
    const result = paginationParams(c)
    expect(result).toEqual({ limit: undefined, cursor: 'abc123' })
  })

  it('parses valid limit', async () => {
    const c = await makeCtx({ limit: '25' })
    const result = paginationParams(c)
    expect(result).toEqual({ limit: 25, cursor: undefined })
  })

  it('parses valid limit with cursor', async () => {
    const c = await makeCtx({ limit: '50', cursor: 'xyz' })
    const result = paginationParams(c)
    expect(result).toEqual({ limit: 50, cursor: 'xyz' })
  })

  it('throws on NaN limit', async () => {
    const c = await makeCtx({ limit: 'abc' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on zero limit', async () => {
    const c = await makeCtx({ limit: '0' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on negative limit', async () => {
    const c = await makeCtx({ limit: '-5' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on limit > 100', async () => {
    const c = await makeCtx({ limit: '101' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('throws on float limit', async () => {
    const c = await makeCtx({ limit: '3.14' })
    expect(() => paginationParams(c)).toThrow('limit must be an integer between 1 and 100')
  })

  it('accepts limit=1 (minimum)', async () => {
    const c = await makeCtx({ limit: '1' })
    const result = paginationParams(c)
    expect(result.limit).toBe(1)
  })

  it('accepts limit=100 (maximum)', async () => {
    const c = await makeCtx({ limit: '100' })
    const result = paginationParams(c)
    expect(result.limit).toBe(100)
  })
})
