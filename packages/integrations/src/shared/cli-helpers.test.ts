import { describe, it, expect, vi } from 'vitest'
import { runConfigureAction, runStatusAction, sanitizeErrorMessage } from './cli-helpers.js'
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

  it('rejects live validation requests during alpha (skipValidation=false throws NOT_SUPPORTED)', async () => {
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
})
