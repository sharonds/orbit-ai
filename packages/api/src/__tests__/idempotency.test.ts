import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import { idempotencyMiddleware, _resetIdempotencyStore } from '../middleware/idempotency.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import '../context.js'

function createApp() {
  const app = new Hono()
  app.onError(orbitErrorHandler)
  app.use('*', requestIdMiddleware())
  app.use('*', idempotencyMiddleware())

  app.post('/v1/contacts', async (c) => {
    const body = await c.req.json()
    return c.json({ id: 'ct_001', name: body.name }, 201)
  })
  app.get('/v1/contacts', (c) => c.json({ data: [] }))

  return app
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    _resetIdempotencyStore()
  })

  it('same key + same route + same body replays stored response', async () => {
    const app = createApp()
    const body = JSON.stringify({ name: 'Alice' })
    const headers = {
      'idempotency-key': 'idem_001',
      'content-type': 'application/json',
    }

    const res1 = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(res1.status).toBe(201)
    const data1 = await res1.json()

    const res2 = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(res2.status).toBe(201)
    const data2 = await res2.json()

    expect(data1).toEqual(data2)
    expect(res2.headers.get('x-idempotent-replayed')).toBe('true')
  })

  it('same key + different body returns 409 IDEMPOTENCY_CONFLICT', async () => {
    const app = createApp()
    const headers = {
      'idempotency-key': 'idem_002',
      'content-type': 'application/json',
    }

    const res1 = await app.request('/v1/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers,
    })
    expect(res1.status).toBe(201)

    const res2 = await app.request('/v1/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob' }),
      headers,
    })
    expect(res2.status).toBe(409)
    const err = (await res2.json()) as { error: { code: string } }
    expect(err.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('GET requests are not subject to idempotency checks', async () => {
    const app = createApp()
    const headers = { 'idempotency-key': 'idem_003' }

    const res1 = await app.request('/v1/contacts', { method: 'GET', headers })
    const res2 = await app.request('/v1/contacts', { method: 'GET', headers })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    // No replay header on GETs
    expect(res2.headers.get('x-idempotent-replayed')).toBeNull()
  })

  it('Idempotency-Key header is echoed in response', async () => {
    const app = createApp()
    const headers = {
      'idempotency-key': 'idem_004',
      'content-type': 'application/json',
    }

    const res = await app.request('/v1/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers,
    })
    expect(res.headers.get('idempotency-key')).toBe('idem_004')
  })

  it('expired idempotency keys are cleaned up', async () => {
    const app = createApp()
    const headers = {
      'idempotency-key': 'idem_005',
      'content-type': 'application/json',
    }
    const body = JSON.stringify({ name: 'Alice' })

    // First request stores the entry
    const res1 = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(res1.status).toBe(201)

    // Simulate expiry by manipulating Date.now
    const originalNow = Date.now
    try {
      Date.now = () => originalNow() + 25 * 60 * 60 * 1000 // 25 hours later

      // Next request with same key should process fresh (expired entry cleaned)
      const res2 = await app.request('/v1/contacts', { method: 'POST', body, headers })
      expect(res2.status).toBe(201)
      // Should NOT be replayed — the entry was expired and evicted
      expect(res2.headers.get('x-idempotent-replayed')).toBeNull()
    } finally {
      Date.now = originalNow
    }
  })

  it('bootstrap paths are exempt from idempotency (no cross-operator collision on unknown orgId)', async () => {
    const app = new Hono()
    app.onError(orbitErrorHandler)
    app.use('*', requestIdMiddleware())
    app.use('*', idempotencyMiddleware())

    let callCount = 0
    app.post('/v1/bootstrap/organizations', async (c) => {
      callCount += 1
      const body = await c.req.json()
      return c.json({ id: `org_${callCount}`, name: body.name }, 201)
    })

    // Two calls with the SAME idempotency key but DIFFERENT bodies must both
    // succeed (bootstrap is exempt). Without the exemption the second would
    // 409 IDEMPOTENCY_CONFLICT because they'd share the 'unknown' orgId bucket.
    const headers = {
      'idempotency-key': 'idem_bootstrap_001',
      'content-type': 'application/json',
    }

    const res1 = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'OrgA' }),
      headers,
    })
    expect(res1.status).toBe(201)
    const body1 = (await res1.json()) as { id: string }
    expect(body1.id).toBe('org_1')

    const res2 = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'OrgB' }),
      headers,
    })
    expect(res2.status).toBe(201)
    const body2 = (await res2.json()) as { id: string }
    expect(body2.id).toBe('org_2')

    // Neither response should claim to be a replay.
    expect(res1.headers.get('x-idempotent-replayed')).toBeNull()
    expect(res2.headers.get('x-idempotent-replayed')).toBeNull()
    expect(callCount).toBe(2)
  })

  it('same idempotency key across different orgIds does NOT replay (cross-tenant isolation)', async () => {
    const app = new Hono()
    app.onError(orbitErrorHandler)
    app.use('*', requestIdMiddleware())

    // Fake tenant context middleware — simulates org A on the first call and
    // org B on the second. In production the real middleware derives this
    // from the API key.
    let nextOrgId = 'org_A'
    app.use('*', async (c, next) => {
      c.set('orbit', { orgId: nextOrgId, scopes: ['*'] })
      await next()
    })

    app.use('*', idempotencyMiddleware())

    let callCount = 0
    app.post('/v1/contacts', async (c) => {
      callCount += 1
      const body = await c.req.json()
      return c.json({ id: `ct_${callCount}`, name: body.name, org: nextOrgId }, 201)
    })

    const body = JSON.stringify({ name: 'Alice' })
    const headers = {
      'idempotency-key': 'idem_xtenant_001',
      'content-type': 'application/json',
    }

    // Org A's first call — processes fresh.
    nextOrgId = 'org_A'
    const resA = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(resA.status).toBe(201)
    const bodyA = (await resA.json()) as { id: string; org: string }
    expect(bodyA.id).toBe('ct_1')
    expect(bodyA.org).toBe('org_A')

    // Org B's call — same idempotency key, same body text — MUST process
    // fresh because the store key is scoped to orgId.
    nextOrgId = 'org_B'
    const resB = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(resB.status).toBe(201)
    const bodyB = (await resB.json()) as { id: string; org: string }
    expect(bodyB.id).toBe('ct_2')
    expect(bodyB.org).toBe('org_B')
    expect(resB.headers.get('x-idempotent-replayed')).toBeNull()

    expect(callCount).toBe(2)

    // Sanity: org A replaying its own key still gets a replay.
    nextOrgId = 'org_A'
    const resA2 = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(resA2.status).toBe(201)
    const bodyA2 = (await resA2.json()) as { id: string; org: string }
    expect(bodyA2.id).toBe('ct_1') // replayed — still the first id
    expect(bodyA2.org).toBe('org_A')
    expect(resA2.headers.get('x-idempotent-replayed')).toBe('true')
    expect(callCount).toBe(2) // handler NOT re-invoked
  })

  it('uses a custom IdempotencyStore when provided via middleware options', async () => {
    const calls: string[] = []
    const customStore = {
      async get(key: string) { calls.push(`get:${key}`); return undefined },
      async set(key: string, _value: any) { calls.push(`set:${key}`) },
      async evictExpired() { calls.push('evictExpired') },
    }

    const app = new Hono()
    app.onError(orbitErrorHandler)
    app.use('*', requestIdMiddleware())
    app.use('*', async (c, next) => {
      c.set('orbit', { orgId: 'org_test', scopes: ['*'] } as any)
      await next()
    })
    app.use('*', idempotencyMiddleware({ store: customStore as any }))

    app.post('/v1/contacts', async (c) => {
      return c.json({ id: 'ct_001' }, 201)
    })

    const res = await app.request('/v1/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers: {
        'idempotency-key': 'idem_custom_001',
        'content-type': 'application/json',
      },
    })
    expect(res.status).toBe(201)
    expect(calls.some(c => c.startsWith('get:'))).toBe(true)
    expect(calls.some(c => c.startsWith('set:'))).toBe(true)
  })

  it('bootstrap skip + cross-tenant isolation compose correctly', async () => {
    // Regression lock from Fix Pass A review: verify that the bootstrap-skip
    // and the cross-tenant replay isolation both hold when combined. Two
    // different orgs hitting /v1/bootstrap/organizations with the same
    // idempotency-key header must both process fresh (bootstrap is exempt).
    const app = new Hono()
    app.onError(orbitErrorHandler)
    app.use('*', requestIdMiddleware())

    let nextOrgId = 'org_A'
    app.use('*', async (c, next) => {
      c.set('orbit', { orgId: nextOrgId, scopes: ['*'] })
      await next()
    })

    app.use('*', idempotencyMiddleware())

    let callCount = 0
    app.post('/v1/bootstrap/organizations', async (c) => {
      callCount += 1
      const body = await c.req.json()
      return c.json({ id: `org_${callCount}`, name: body.name, via: nextOrgId }, 201)
    })

    const headers = {
      'idempotency-key': 'idem_bootstrap_cross_tenant_001',
      'content-type': 'application/json',
    }

    // Org A's bootstrap call
    nextOrgId = 'org_A'
    const resA = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme' }),
      headers,
    })
    expect(resA.status).toBe(201)
    const bodyA = (await resA.json()) as { id: string; via: string }
    expect(bodyA.id).toBe('org_1')
    expect(bodyA.via).toBe('org_A')

    // Org B's bootstrap call with the same key — must process fresh
    // because bootstrap paths are exempt from idempotency.
    nextOrgId = 'org_B'
    const resB = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Beta Corp' }),
      headers,
    })
    expect(resB.status).toBe(201)
    const bodyB = (await resB.json()) as { id: string; via: string }
    expect(bodyB.id).toBe('org_2')
    expect(bodyB.via).toBe('org_B')

    // Neither response claims replay
    expect(resA.headers.get('x-idempotent-replayed')).toBeNull()
    expect(resB.headers.get('x-idempotent-replayed')).toBeNull()
    expect(callCount).toBe(2)
  })
})
