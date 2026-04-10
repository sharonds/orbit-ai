import { describe, expect, it } from 'vitest'
import { authenticateRequest, resolveHttpOptions, startHttpTransport } from '../transports/http.js'
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

  it('returns 400 when request body exceeds 1 MB', async () => {
    const adapter = {
      lookupApiKeyForAuth: async () => ({
        id: 'key_01',
        organizationId: 'org_01',
        scopes: ['*'],
        revokedAt: null,
        expiresAt: null,
      }),
    }
    const runtime = await startHttpTransport({
      client: makeMockClient(),
      transport: 'http',
      port: 0,
      adapter: adapter as never,
    })

    const addr = runtime.server.address() as import('node:net').AddressInfo
    const actualPort = addr.port

    try {
      const largeBody = JSON.stringify({ query: 'x'.repeat(1_100_000) })
      const response = await fetch(`http://127.0.0.1:${actualPort}/`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: largeBody,
      })
      expect(response.status).toBe(400)
      // The HTTP handler serializes a CallToolResult: { isError: true, content: [{ type: 'text', text: '{"ok":false,"error":{...}}' }] }
      const outer = await response.json() as { isError?: boolean; content?: Array<{ type: string; text?: string }> }
      const textBlock = outer.content?.find((b) => b.type === 'text' && typeof b.text === 'string')
      const inner = JSON.parse(textBlock?.text ?? '{}') as { error?: { code?: string; message?: string } }
      expect(inner.error?.code).toBe('VALIDATION_FAILED')
      expect(inner.error?.message).toBe('Request body exceeds the 1 MB limit.')
    } finally {
      await new Promise<void>((resolve) => runtime.server.close(() => resolve()))
    }
  })

  it('returns 400 with malformed JSON body message when JSON is invalid', async () => {
    const adapter = {
      lookupApiKeyForAuth: async () => ({
        id: 'key_01',
        organizationId: 'org_01',
        scopes: ['*'],
        revokedAt: null,
        expiresAt: null,
      }),
    }
    const runtime = await startHttpTransport({
      client: makeMockClient(),
      transport: 'http',
      port: 0,
      adapter: adapter as never,
    })

    const addr = runtime.server.address() as import('node:net').AddressInfo
    const actualPort = addr.port

    try {
      const response = await fetch(`http://127.0.0.1:${actualPort}/`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: '{ this is not valid json }',
      })
      expect(response.status).toBe(400)
      const outer = await response.json() as { isError?: boolean; content?: Array<{ type: string; text?: string }> }
      const textBlock = outer.content?.find((b) => b.type === 'text' && typeof b.text === 'string')
      const inner = JSON.parse(textBlock?.text ?? '{}') as { error?: { code?: string; message?: string } }
      expect(inner.error?.code).toBe('VALIDATION_FAILED')
      expect(inner.error?.message).toBe('Malformed JSON body.')
    } finally {
      await new Promise<void>((resolve) => runtime.server.close(() => resolve()))
    }
  })
})
