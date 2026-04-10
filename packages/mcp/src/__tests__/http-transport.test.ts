import { describe, expect, it } from 'vitest'
import { authenticateRequest, resolveHttpOptions } from '../transports/http.js'
import { makeMockClient } from './helpers.js'

describe('http transport', () => {
  it('rejects missing authorization header', async () => {
    const adapter = { lookupApiKeyForAuth: async () => null }
    const result = await authenticateRequest({ headers: {} } as never, adapter as never)
    expect(result.ok).toBe(false)
  })

  it('rejects invalid bearer tokens', async () => {
    const adapter = { lookupApiKeyForAuth: async () => null }
    const result = await authenticateRequest(
      { headers: { authorization: 'Bearer bad' } } as never,
      adapter as never,
    )
    expect(result.ok).toBe(false)
  })

  it('accepts a valid bearer token', async () => {
    const adapter = {
      lookupApiKeyForAuth: async () => ({
        id: 'key_01',
        organizationId: 'org_01',
        scopes: ['*'],
        revokedAt: null,
        expiresAt: null,
      }),
    }
    const result = await authenticateRequest(
      { headers: { authorization: 'Bearer good' } } as never,
      adapter as never,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key.organizationId).toBe('org_01')
    }
  })

  it('rejects a revoked bearer token with 401', async () => {
    const adapter = {
      lookupApiKeyForAuth: async () => ({
        id: 'key_revoked',
        organizationId: 'org_01',
        scopes: ['*'],
        revokedAt: new Date('2024-01-01T00:00:00Z'),
        expiresAt: null,
      }),
    }
    const result = await authenticateRequest(
      { headers: { authorization: 'Bearer validtoken' } } as never,
      adapter as never,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('revoked')
    }
  })

  it('rejects an expired bearer token with 401', async () => {
    const adapter = {
      lookupApiKeyForAuth: async () => ({
        id: 'key_expired',
        organizationId: 'org_01',
        scopes: ['*'],
        revokedAt: null,
        expiresAt: new Date('2020-01-01T00:00:00Z'),
      }),
    }
    const result = await authenticateRequest(
      { headers: { authorization: 'Bearer validtoken' } } as never,
      adapter as never,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('expired')
    }
  })

  it('binds to 127.0.0.1 by default', async () => {
    expect(resolveHttpOptions({ port: 0 }).bindAddress).toBe('127.0.0.1')
  })
})
