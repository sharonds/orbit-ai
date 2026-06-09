import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import { OrbitError, type OrbitErrorCode } from '@orbit-ai/core'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import '../context.js'

const MIGRATION_ERROR_STATUS_CASES: Array<[OrbitErrorCode, number]> = [
  ['MIGRATION_AUTHORITY_UNAVAILABLE', 503],
  ['DESTRUCTIVE_CONFIRMATION_REQUIRED', 409],
  ['DESTRUCTIVE_CONFIRMATION_STALE', 409],
  ['MIGRATION_CONFLICT', 409],
  ['ROLLBACK_PRECONDITION_FAILED', 412],
  ['MIGRATION_OPERATION_UNSUPPORTED', 400],
]

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

  it('maps ZodError to 400 VALIDATION_FAILED with field-level hints', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    // In Zod v4, `new ZodError([...])` no longer extends Error, so Hono's
    // error boundary won't catch it. Use schema.parse() to produce a real
    // ZodError that IS an Error instance and will reach onError.
    const TestSchema = z.object({ name: z.string(), email: z.string() })
    app.post('/validate', () => {
      TestSchema.parse({ name: undefined, email: 42 })
    })

    const res = await app.request('/validate', { method: 'POST' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      error: { code: string; message: string; hint: string; retryable: boolean }
    }
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.message).toBe('Request body failed validation')
    expect(body.error.hint).toContain('name')
    expect(body.error.hint).toContain('email')
    expect(body.error.retryable).toBe(false)

    // ZodError is a client-caused validation error — not a server bug, should NOT be logged
    expect(spy).not.toHaveBeenCalled()
  })

  it.each(MIGRATION_ERROR_STATUS_CASES)(
    'maps %s to HTTP %i',
    async (code, status) => {
      const app = new Hono()
      app.use('*', requestIdMiddleware())
      app.onError(orbitErrorHandler)
      app.get('/migration-error', () => {
        throw new OrbitError({ code, message: code })
      })

      const res = await app.request('/migration-error', { method: 'GET' })
      const body = (await res.json()) as { error: { code: string } }

      expect(res.status).toBe(status)
      expect(body.error.code).toBe(code)
    },
  )
})
