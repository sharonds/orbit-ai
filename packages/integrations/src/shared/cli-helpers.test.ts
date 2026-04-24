import { describe, it, expect, vi } from 'vitest'
import {
  resolveOAuthCredentials,
  runConfigureAction,
  runStatusAction,
  sanitizeErrorMessage,
} from './cli-helpers.js'
import { InMemoryCredentialStore } from '../credentials.js'

describe('runConfigureAction', () => {
  it('persists credentials and reports configured=true when skipValidation=true', async () => {
    const store = new InMemoryCredentialStore()
    const result = await runConfigureAction({
      provider: 'gmail',
      organizationId: 'org_01TEST',
      userId: 'user_01TEST',
      credentials: { accessToken: 'a', refreshToken: 'r' },
      credentialStore: store,
      skipValidation: true,
    })
    expect(result.configured).toBe(true)
    expect(await store.getCredentials('org_01TEST', 'gmail', 'user_01TEST')).toBeTruthy()
  })

  it('returns configured=false with NOT_SUPPORTED error when skipValidation=false', async () => {
    const store = new InMemoryCredentialStore()
    const result = await runConfigureAction({
      provider: 'gmail',
      organizationId: 'org_01TEST',
      userId: 'user_01TEST',
      credentials: { accessToken: 'a', refreshToken: 'r' },
      credentialStore: store,
      skipValidation: false,
    })
    expect(result.configured).toBe(false)
    expect(result.error).toMatch(/live validation.*not.*supported/i)
    expect(await store.getCredentials('org_01TEST', 'gmail', 'user_01TEST')).toBeNull()
  })
})

describe('runStatusAction', () => {
  it('returns configured=true when credentials exist for the provider', async () => {
    const store = new InMemoryCredentialStore()
    await store.saveCredentials('org_01TEST', 'gmail', 'user_01TEST', { accessToken: 'a', refreshToken: 'r' })
    const result = await runStatusAction({
      provider: 'gmail',
      organizationId: 'org_01TEST',
      userId: 'user_01TEST',
      credentialStore: store,
    })
    expect(result).toMatchObject({ provider: 'gmail', configured: true, status: 'configured' })
  })

  it('returns configured=false when credentials do not exist', async () => {
    const store = new InMemoryCredentialStore()
    const result = await runStatusAction({
      provider: 'gmail',
      organizationId: 'org_01TEST',
      userId: 'user_01TEST',
      credentialStore: store,
    })
    expect(result.configured).toBe(false)
  })
})

describe('sanitizeErrorMessage', () => {
  it('masks tokens, keys, and bearer headers in error text', () => {
    const msg = 'Unauthorized: token=sk_live_abc123 Bearer ya29.a0AfH6SMC_XYZ refresh_token=1//abcdefgh'
    const sanitized = sanitizeErrorMessage(msg)
    expect(sanitized).not.toContain('sk_live_abc123')
    expect(sanitized).not.toContain('ya29.a0AfH6SMC_XYZ')
    expect(sanitized).not.toContain('1//abcdefgh')
    expect(sanitized).toMatch(/\*\*\*/)
  })
  it('preserves non-secret error structure', () => {
    expect(sanitizeErrorMessage('Network error: ECONNREFUSED')).toBe('Network error: ECONNREFUSED')
  })

  it('masks JSON, camelCase, and snake_case secret fields in error text', () => {
    const msg = [
      'request failed',
      '{"accessToken":"ya29.camel","refresh_token":"1//snake","clientSecret":"topsecret"}',
      'apiKey: sk_live_abcdefghijkl',
      'refreshToken = 1//camelrefresh',
    ].join(' ')
    const sanitized = sanitizeErrorMessage(msg)
    expect(sanitized).not.toContain('ya29.camel')
    expect(sanitized).not.toContain('1//snake')
    expect(sanitized).not.toContain('topsecret')
    expect(sanitized).not.toContain('sk_live_abcdefghijkl')
    expect(sanitized).not.toContain('1//camelrefresh')
    expect(sanitized).toContain('"accessToken":"***"')
    expect(sanitized).toContain('"refresh_token":"***"')
  })
})

describe('resolveOAuthCredentials', () => {
  it('resolves OAuth tokens from environment variables without argv values', async () => {
    const credentials = await resolveOAuthCredentials(
      {
        accessTokenEnv: 'TEST_ACCESS_TOKEN',
        refreshTokenEnv: 'TEST_REFRESH_TOKEN',
      },
      {
        env: {
          TEST_ACCESS_TOKEN: 'env-access',
          TEST_REFRESH_TOKEN: 'env-refresh',
        },
      },
    )
    expect(credentials).toEqual({ accessToken: 'env-access', refreshToken: 'env-refresh' })
  })

  it('warns and redacts process argv when OAuth tokens are supplied as argv flags', async () => {
    const stderr: string[] = []
    const argv = [
      'node',
      'orbit',
      '--access-token',
      'argv-access',
      '--refresh-token=argv-refresh',
    ]
    const credentials = await resolveOAuthCredentials(
      { accessToken: 'argv-access', refreshToken: 'argv-refresh' },
      {
        argv,
        warn: (msg) => stderr.push(msg),
      },
    )
    expect(credentials).toEqual({ accessToken: 'argv-access', refreshToken: 'argv-refresh' })
    expect(stderr.join('\n')).toMatch(/visible in process listings/i)
    expect(argv).not.toContain('argv-access')
    expect(argv).not.toContain('--refresh-token=argv-refresh')
    expect(argv).toContain('[REDACTED]')
    expect(argv).toContain('--refresh-token=[REDACTED]')
  })

  it('lets explicit argv token values override ambient default provider env vars', async () => {
    const credentials = await resolveOAuthCredentials(
      { accessToken: 'argv-access', refreshToken: 'argv-refresh' },
      {
        defaultAccessTokenEnv: 'ORBIT_GMAIL_ACCESS_TOKEN',
        defaultRefreshTokenEnv: 'ORBIT_GMAIL_REFRESH_TOKEN',
        env: {
          ORBIT_GMAIL_ACCESS_TOKEN: 'stale-env-access',
          ORBIT_GMAIL_REFRESH_TOKEN: 'stale-env-refresh',
        },
        argv: ['node', 'orbit'],
      },
    )
    expect(credentials).toEqual({ accessToken: 'argv-access', refreshToken: 'argv-refresh' })
  })
})
