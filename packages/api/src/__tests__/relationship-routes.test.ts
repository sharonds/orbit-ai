import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { registerRelationshipRoutes } from '../routes/relationships.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'

function createRouteTestApp(scopes: string[] = ['*']) {
  const app = new Hono()
  app.onError(orbitErrorHandler)
  app.use('*', requestIdMiddleware())
  app.use('/v1/*', versionMiddleware('2026-04-01'))
  app.use('/v1/*', async (c, next) => {
    c.set('orbit', { orgId: 'org_test', apiKeyId: 'key_test', scopes })
    await next()
  })
  return app
}

describe('Relationship routes — pagination', () => {
  it('GET /v1/contacts/:id/deals passes limit and cursor to service', async () => {
    const dealsFn = vi.fn(async (_ctx: any, _id: string, _opts: any) => ({
      data: [{ id: 'deal_01' }],
      hasMore: true,
      nextCursor: 'cursor_abc',
    }))
    const services = { contacts: { deals: dealsFn } } as unknown as CoreServices
    const app = createRouteTestApp()
    registerRelationshipRoutes(app, services)

    const res = await app.request('/v1/contacts/contact_01/deals?limit=10&cursor=cursor_xyz')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.meta.has_more).toBe(true)
    expect(body.meta.next_cursor).toBe('cursor_abc')
    expect(dealsFn).toHaveBeenCalledWith(
      expect.anything(),
      'contact_01',
      { limit: 10, cursor: 'cursor_xyz' },
    )
  })

  it('GET /v1/contacts/:id/timeline returns pagination metadata', async () => {
    const timelineFn = vi.fn(async (_ctx: any, _id: string, _opts: any) => ({
      data: [{ id: 'activity_01' }],
      hasMore: false,
      nextCursor: null,
    }))
    const services = { contacts: { timeline: timelineFn } } as unknown as CoreServices
    const app = createRouteTestApp()
    registerRelationshipRoutes(app, services)

    const res = await app.request('/v1/contacts/contact_01/timeline')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.meta.has_more).toBe(false)
    expect(body.meta.next_cursor).toBeNull()
  })
})

describe('Relationship routes — limit validation', () => {
  it('rejects non-numeric limit with 400', async () => {
    const dealsFn = vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null }))
    const services = { contacts: { deals: dealsFn } } as unknown as CoreServices
    const app = createRouteTestApp()
    registerRelationshipRoutes(app, services)

    const res = await app.request('/v1/contacts/contact_01/deals?limit=abc')
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects float limit with 400', async () => {
    const dealsFn = vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null }))
    const services = { contacts: { deals: dealsFn } } as unknown as CoreServices
    const app = createRouteTestApp()
    registerRelationshipRoutes(app, services)

    const res = await app.request('/v1/contacts/contact_01/deals?limit=10.5')
    expect(res.status).toBe(400)
  })

  it('rejects limit over 100 with 400', async () => {
    const dealsFn = vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null }))
    const services = { contacts: { deals: dealsFn } } as unknown as CoreServices
    const app = createRouteTestApp()
    registerRelationshipRoutes(app, services)

    const res = await app.request('/v1/contacts/contact_01/deals?limit=101')
    expect(res.status).toBe(400)
  })

  it('rejects limit=0 with 400', async () => {
    const dealsFn = vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null }))
    const services = { contacts: { deals: dealsFn } } as unknown as CoreServices
    const app = createRouteTestApp()
    registerRelationshipRoutes(app, services)

    const res = await app.request('/v1/contacts/contact_01/deals?limit=0')
    expect(res.status).toBe(400)
  })
})
