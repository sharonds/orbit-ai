import { describe, it, expect } from 'vitest'
import {
  isSensitiveIntegrationKey,
  redactProviderError,
  sanitizeIntegrationMetadata,
  toIntegrationConnectionRead,
} from './redaction.js'

describe('isSensitiveIntegrationKey', () => {
  it.each([
    'token',
    'secret',
    'access_token',
    'refresh_token',
    'password',
    'private_key',
    'signature',
    'credential',
    'api_key',
    'client_secret',
  ])('"%s" → true (exact match)', (key) => {
    expect(isSensitiveIntegrationKey(key)).toBe(true)
  })

  it.each([
    'accessToken',
    'refreshToken',
    'apiKey',
    'clientSecret',
    'privateKey',
  ])('camelCase "%s" → true', (key) => {
    expect(isSensitiveIntegrationKey(key)).toBe(true)
  })

  it.each([
    'authorized_at',
    'auth_provider',
    'authorization_type',
    'created_at',
    'updated_at',
    'tokenized_field',   // has 'token' as substring but not exact
    'providerAccountId',
    'connectionType',
    'status',
    'id',
  ])('"%s" → false (substring or unrelated key)', (key) => {
    expect(isSensitiveIntegrationKey(key)).toBe(false)
  })
})

describe('redactProviderError', () => {
  it('redacts Bearer tokens', () => {
    const msg = 'Request failed: Authorization: Bearer ya29.ABCDEF12345'
    const result = redactProviderError(msg)
    expect(result).toContain('Bearer [REDACTED]')
    expect(result).not.toContain('ya29.ABCDEF12345')
  })

  it('redacts ya29.* Google OAuth access tokens', () => {
    const msg = 'Token expired: ya29.A0ARrdaM-abc_XYZ-1234 was rejected'
    const result = redactProviderError(msg)
    expect(result).toContain('ya29.[REDACTED]')
    expect(result).not.toContain('ya29.A0ARrdaM-abc_XYZ-1234')
  })

  it('redacts JWT tokens (eyJ...)', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const msg = `Invalid token: ${jwt}`
    const result = redactProviderError(msg)
    expect(result).toContain('[JWT_REDACTED]')
    expect(result).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9')
  })

  it('redacts key=value pairs with sensitive keys', () => {
    const msg = 'Error calling API with token=abc123xyz&client_id=my-app'
    const result = redactProviderError(msg)
    expect(result).toContain('token=[REDACTED]')
    expect(result).not.toContain('token=abc123xyz')
    // client_id is not sensitive
    expect(result).toContain('client_id=my-app')
  })

  it('does not redact short unrelated strings like ULIDs or message IDs', () => {
    const msg = 'Processing message 01HXYZ123456789ABCDEFGHIJK from thread abc123'
    const result = redactProviderError(msg)
    expect(result).toBe(msg)
  })

  it('returns unchanged string when no sensitive patterns present', () => {
    const msg = 'Connection failed: network timeout after 30s'
    expect(redactProviderError(msg)).toBe(msg)
  })
})

describe('sanitizeIntegrationMetadata', () => {
  it('redacts top-level sensitive key', () => {
    const obj = { token: 'abc123', name: 'test' }
    const result = sanitizeIntegrationMetadata(obj)
    expect(result['token']).toBe('[REDACTED]')
    expect(result['name']).toBe('test')
  })

  it('redacts nested sensitive keys (recursive)', () => {
    const obj = {
      provider: 'gmail',
      auth: {
        accessToken: 'ya29.abc',
        refreshToken: 'refresh-xyz',
        scope: 'https://mail.google.com/',
      },
    }
    const result = sanitizeIntegrationMetadata(obj)
    const auth = result['auth'] as Record<string, unknown>
    expect(auth['accessToken']).toBe('[REDACTED]')
    expect(auth['refreshToken']).toBe('[REDACTED]')
    expect(auth['scope']).toBe('https://mail.google.com/')
    expect(result['provider']).toBe('gmail')
  })

  it('does NOT redact non-sensitive keys like authorized_at, auth_provider', () => {
    const obj = {
      authorized_at: '2026-04-01T00:00:00Z',
      auth_provider: 'google',
      authorization_type: 'oauth2',
      created_at: '2026-01-01T00:00:00Z',
    }
    const result = sanitizeIntegrationMetadata(obj)
    expect(result['authorized_at']).toBe('2026-04-01T00:00:00Z')
    expect(result['auth_provider']).toBe('google')
    expect(result['authorization_type']).toBe('oauth2')
    expect(result['created_at']).toBe('2026-01-01T00:00:00Z')
  })

  it('preserves primitive arrays unchanged', () => {
    const obj = { scopes: ['read', 'write'], count: 2 }
    const result = sanitizeIntegrationMetadata(obj)
    expect(result['scopes']).toEqual(['read', 'write'])
    expect(result['count']).toBe(2)
  })

  it('sanitizes sensitive keys inside array elements', () => {
    const obj = {
      connections: [
        { name: 'gmail', accessToken: 'ya29.secret', status: 'active' },
        { name: 'stripe', apiKey: 'sk_live_abc', status: 'active' },
      ],
    }
    const result = sanitizeIntegrationMetadata(obj)
    const connections = result['connections'] as Array<Record<string, unknown>>
    expect(connections[0]!['accessToken']).toBe('[REDACTED]')
    expect(connections[1]!['apiKey']).toBe('[REDACTED]')
    expect(connections[0]!['name']).toBe('gmail')
  })

  it('sanitizes sensitive keys inside nested arrays (arrays within arrays)', () => {
    const obj = {
      data: [[{ token: 'secret_value', name: 'test' }]],
    }
    const result = sanitizeIntegrationMetadata(obj)
    const inner = (result['data'] as unknown[][])[0]! as Array<Record<string, unknown>>
    expect(inner[0]!['token']).toBe('[REDACTED]')
    expect(inner[0]!['name']).toBe('test')
  })

  it('returns empty object when depth exceeds 10 (cycle protection)', () => {
    // Simulate deep nesting
    let deepObj: Record<string, unknown> = { leaf: 'value' }
    for (let i = 0; i < 12; i++) {
      deepObj = { nested: deepObj }
    }
    // Should not throw, just truncate
    expect(() => sanitizeIntegrationMetadata(deepObj)).not.toThrow()
  })
})

describe('toIntegrationConnectionRead', () => {
  const baseRow = {
    id: 'conn_01',
    organizationId: 'org_01',
    provider: 'gmail',
    connectionType: 'oauth2',
    userId: 'user_01',
    status: 'active',
    accessTokenExpiresAt: null as Date | string | null,
    providerAccountId: 'user@example.com',
    providerWebhookId: null as string | null,
    scopes: 'https://mail.google.com/',
    failureCount: 0,
    lastSuccessAt: null as Date | string | null,
    lastFailureAt: null as Date | string | null,
    metadata: null as Record<string, unknown> | null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }

  it('converts Date instances to ISO strings', () => {
    const now = new Date('2026-04-10T10:00:00Z')
    const row = {
      ...baseRow,
      accessTokenExpiresAt: now,
      lastSuccessAt: now,
      createdAt: now,
      updatedAt: now,
    }
    const result = toIntegrationConnectionRead(row)
    expect(result.accessTokenExpiresAt).toBe('2026-04-10T10:00:00.000Z')
    expect(result.lastSuccessAt).toBe('2026-04-10T10:00:00.000Z')
    expect(result.createdAt).toBe('2026-04-10T10:00:00.000Z')
    expect(result.updatedAt).toBe('2026-04-10T10:00:00.000Z')
  })

  it('passes through string timestamps unchanged', () => {
    const result = toIntegrationConnectionRead(baseRow)
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(result.updatedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('does NOT include credentialsEncrypted or refreshTokenEncrypted in output', () => {
    const rowWithSecrets = {
      ...baseRow,
      credentialsEncrypted: 'iv:data:tag',
      refreshTokenEncrypted: 'iv:data2:tag2',
    }
    // Cast to any to simulate DB row that includes encrypted fields
    const result = toIntegrationConnectionRead(rowWithSecrets as unknown as typeof baseRow)
    expect(result).not.toHaveProperty('credentialsEncrypted')
    expect(result).not.toHaveProperty('refreshTokenEncrypted')
  })

  it('sanitizes metadata with sensitive keys', () => {
    const row = {
      ...baseRow,
      metadata: {
        provider_config: 'some-value',
        token: 'leaked-token',
        authorized_at: '2026-01-01',
      },
    }
    const result = toIntegrationConnectionRead(row)
    const meta = result.metadata as Record<string, unknown>
    expect(meta['token']).toBe('[REDACTED]')
    expect(meta['provider_config']).toBe('some-value')
    expect(meta['authorized_at']).toBe('2026-01-01')
  })

  it('passes null metadata as null', () => {
    const result = toIntegrationConnectionRead(baseRow)
    expect(result.metadata).toBeNull()
  })
})
