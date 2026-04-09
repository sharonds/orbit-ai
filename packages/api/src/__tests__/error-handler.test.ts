import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import '../context.js'

describe('orbitErrorHandler logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs unexpected (non-OrbitError) errors to stderr with request context', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    app.get('/boom', () => {
      throw new Error('kaboom')
    })

    const res = await app.request('/boom', { method: 'GET' })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; request_id?: string } }
    expect(body.error.code).toBe('INTERNAL_ERROR')

    expect(spy).toHaveBeenCalledTimes(1)
    const logged = spy.mock.calls[0]![0] as Record<string, unknown>
    expect(logged).toMatchObject({
      msg: expect.stringContaining('unhandled error'),
      err: expect.objectContaining({
        name: 'Error',
        message: 'kaboom',
      }),
      method: 'GET',
      path: '/boom',
    })
    expect(typeof logged.request_id).toBe('string')
  })

  it('does NOT log when the error is an OrbitError (these are expected, not bugs)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    app.get('/not-found', () => {
      throw new OrbitError({
        code: 'RESOURCE_NOT_FOUND',
        message: 'nope',
      })
    })

    const res = await app.request('/not-found', { method: 'GET' })
    expect(res.status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does NOT log JSON SyntaxErrors (these are client-caused 400s, not server bugs)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    app.post('/echo', async (c) => {
      const body = await c.req.json()
      return c.json(body)
    })

    const res = await app.request('/echo', {
      method: 'POST',
      body: '{not json',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})
