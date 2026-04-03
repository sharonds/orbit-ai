import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type { StorageAdapter, ApiKeyAuthLookup, OrbitAuthContext } from '@orbit-ai/core'
import { OrbitError } from '@orbit-ai/core'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { authMiddleware } from '../middleware/auth.js'
import { tenantContextMiddleware } from '../middleware/tenant-context.js'
import { requireScope } from '../scopes.js'

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

// --- Helpers for auth / tenant tests ---

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const TEST_TOKEN = 'sk_test_abc123'

function validKey(): ApiKeyAuthLookup {
  return {
    id: 'key_001',
    organizationId: 'org_001',
    scopes: ['contacts:read', 'contacts:write'],
    revokedAt: null,
    expiresAt: null,
  }
}

function createMockAdapter(
  overrides: Partial<{
    lookupApiKeyForAuth: (hash: string) => Promise<ApiKeyAuthLookup | null>
    withTenantContext: <T>(
      ctx: OrbitAuthContext,
      fn: () => Promise<T>,
    ) => Promise<T>
  }> = {},
): StorageAdapter {
  return {
    lookupApiKeyForAuth:
      overrides.lookupApiKeyForAuth ??
      (async () => validKey()),
    withTenantContext:
      overrides.withTenantContext ??
      (async (_ctx, fn) => fn({} as never)),
  } as unknown as StorageAdapter
}

function createAuthApp(adapter: StorageAdapter) {
  const app = new Hono()
  app.use('*', requestIdMiddleware())
  app.use('*', authMiddleware(adapter))
  app.onError((err, c) => {
    if (err instanceof OrbitError) {
      return c.json({ code: err.code, message: err.message }, 401)
    }
    return c.json({ code: 'INTERNAL_ERROR', message: err.message }, 500)
  })
  app.get('/test', (c) => {
    const ctx = c.get('orbit')
    return c.json({
      orgId: ctx.orgId,
      apiKeyId: ctx.apiKeyId,
      scopes: ctx.scopes,
    })
  })
  return app
}

// --- Auth middleware tests ---

describe('authMiddleware', () => {
  it('resolves a valid API key and sets context', async () => {
    const adapter = createMockAdapter()
    const app = createAuthApp(adapter)

    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      orgId: string
      apiKeyId: string
      scopes: string[]
    }
    expect(body.orgId).toBe('org_001')
    expect(body.apiKeyId).toBe('key_001')
    expect(body.scopes).toEqual(['contacts:read', 'contacts:write'])
  })

  it('rejects missing bearer token with 401', async () => {
    const adapter = createMockAdapter()
    const app = createAuthApp(adapter)

    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('AUTH_INVALID_API_KEY')
  })

  it('rejects a revoked key with 401', async () => {
    const adapter = createMockAdapter({
      lookupApiKeyForAuth: async () => ({
        ...validKey(),
        revokedAt: new Date('2026-01-01'),
      }),
    })
    const app = createAuthApp(adapter)

    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string; message: string }
    expect(body.code).toBe('AUTH_INVALID_API_KEY')
    expect(body.message).toMatch(/revoked/i)
  })

  it('rejects an expired key with 401', async () => {
    const adapter = createMockAdapter({
      lookupApiKeyForAuth: async () => ({
        ...validKey(),
        expiresAt: new Date('2020-01-01'),
      }),
    })
    const app = createAuthApp(adapter)

    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string; message: string }
    expect(body.code).toBe('AUTH_INVALID_API_KEY')
    expect(body.message).toMatch(/expired/i)
  })

  it('sets scopes and apiKeyId on context', async () => {
    const adapter = createMockAdapter({
      lookupApiKeyForAuth: async () => ({
        ...validKey(),
        scopes: ['*'],
        id: 'key_admin',
      }),
    })
    const app = createAuthApp(adapter)

    const res = await app.request('/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { apiKeyId: string; scopes: string[] }
    expect(body.apiKeyId).toBe('key_admin')
    expect(body.scopes).toEqual(['*'])
  })

  it('never calls runWithMigrationAuthority', async () => {
    const runWithMigrationAuthority = vi.fn()
    const adapter = createMockAdapter()
    ;(adapter as Record<string, unknown>).runWithMigrationAuthority =
      runWithMigrationAuthority
    const app = createAuthApp(adapter)

    await app.request('/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(runWithMigrationAuthority).not.toHaveBeenCalled()
  })

  it('hashes the token before lookup', async () => {
    const lookupSpy = vi.fn(async () => validKey())
    const adapter = createMockAdapter({
      lookupApiKeyForAuth: lookupSpy,
    })
    const app = createAuthApp(adapter)

    await app.request('/test', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })

    const expectedHash = await hashToken(TEST_TOKEN)
    expect(lookupSpy).toHaveBeenCalledWith(expectedHash)
  })
})

// --- Tenant context middleware tests ---

describe('tenantContextMiddleware', () => {
  it('wraps non-bootstrap paths with withTenantContext', async () => {
    const withTenantContext = vi.fn(async (_ctx: OrbitAuthContext, fn: () => Promise<unknown>) => fn())
    const adapter = createMockAdapter({ withTenantContext })

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.use('*', tenantContextMiddleware(adapter))
    app.onError((err, c) => {
      if (err instanceof OrbitError) {
        return c.json({ code: err.code }, 401)
      }
      return c.json({ code: 'INTERNAL_ERROR' }, 500)
    })
    app.get('/v1/contacts', (c) => c.json({ ok: true }))

    const res = await app.request('/v1/contacts', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
    expect(withTenantContext).toHaveBeenCalledTimes(1)
    expect(withTenantContext.mock.calls[0]![0]).toMatchObject({
      orgId: 'org_001',
    })
  })

  it('skips bootstrap paths', async () => {
    const withTenantContext = vi.fn(async (_ctx: OrbitAuthContext, fn: () => Promise<unknown>) => fn())
    const adapter = createMockAdapter({ withTenantContext })

    const app = new Hono()
    // No auth middleware for bootstrap
    app.use('*', tenantContextMiddleware(adapter))
    app.get('/v1/bootstrap/org', (c) => c.json({ ok: true }))

    const res = await app.request('/v1/bootstrap/org')
    expect(res.status).toBe(200)
    expect(withTenantContext).not.toHaveBeenCalled()
  })

  it('rejects when orbit context is missing on non-bootstrap path', async () => {
    const adapter = createMockAdapter()

    const app = new Hono()
    // Intentionally no auth middleware — orbit context won't be set
    app.use('*', tenantContextMiddleware(adapter))
    app.onError((err, c) => {
      if (err instanceof OrbitError) {
        return c.json({ code: err.code }, 401)
      }
      return c.json({ code: 'INTERNAL_ERROR' }, 500)
    })
    app.get('/v1/contacts', (c) => c.json({ ok: true }))

    const res = await app.request('/v1/contacts')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('AUTH_CONTEXT_REQUIRED')
  })
})

// --- Scope middleware tests ---

describe('requireScope', () => {
  function createScopeApp(scopes: string[], requiredScope: string) {
    const adapter = createMockAdapter({
      lookupApiKeyForAuth: async () => ({ ...validKey(), scopes }),
    })
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.use('/v1/contacts/*', requireScope(requiredScope))
    app.onError((err, c) => {
      if (err instanceof OrbitError) {
        const status = err.code === 'AUTH_INSUFFICIENT_SCOPE' ? 403 : 401
        return c.json({ code: err.code, message: err.message }, status)
      }
      return c.json({ code: 'INTERNAL_ERROR' }, 500)
    })
    app.get('/v1/contacts/list', (c) => c.json({ ok: true }))
    return app
  }

  it('allows exact scope match', async () => {
    const app = createScopeApp(['contacts:read'], 'contacts:read')
    const res = await app.request('/v1/contacts/list', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  it('allows wildcard * scope', async () => {
    const app = createScopeApp(['*'], 'contacts:read')
    const res = await app.request('/v1/contacts/list', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  it('allows resource wildcard scope', async () => {
    const app = createScopeApp(['contacts:*'], 'contacts:read')
    const res = await app.request('/v1/contacts/list', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  it('allows admin:* for admin scopes', async () => {
    const app = createScopeApp(['admin:*'], 'admin:users')
    const res = await app.request('/v1/contacts/list', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  it('rejects insufficient scope with 403', async () => {
    const app = createScopeApp(['contacts:read'], 'contacts:write')
    const res = await app.request('/v1/contacts/list', {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('AUTH_INSUFFICIENT_SCOPE')
  })
})
