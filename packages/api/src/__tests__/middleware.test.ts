import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'

describe('requestIdMiddleware', () => {
  it('assigns a request ID to every request', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }))

    const res = await app.request('/test')
    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toMatch(/^req_/)
  })

  it('preserves a client-provided X-Request-Id', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }))

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'req_custom123' },
    })
    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toBe('req_custom123')
  })

  it('echoes request ID in response header', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.headers.get('x-request-id')).toMatch(/^req_/)
  })
})

describe('versionMiddleware', () => {
  it('resolves Orbit-Version from header', async () => {
    const app = new Hono()
    app.use('*', versionMiddleware('2026-04-01'))
    app.get('/test', (c) => c.json({ version: c.get('orbitVersion') }))

    const res = await app.request('/test', {
      headers: { 'orbit-version': '2026-03-01' },
    })
    const body = (await res.json()) as { version: string }
    expect(body.version).toBe('2026-03-01')
  })

  it('defaults to server version when header is absent', async () => {
    const app = new Hono()
    app.use('*', versionMiddleware('2026-04-01'))
    app.get('/test', (c) => c.json({ version: c.get('orbitVersion') }))

    const res = await app.request('/test')
    const body = (await res.json()) as { version: string }
    expect(body.version).toBe('2026-04-01')
  })
})
