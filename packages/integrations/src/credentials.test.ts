import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCredentialStore } from './credentials.js'
import type { StoredCredentials } from './credentials.js'

const makeCredentials = (overrides: Partial<StoredCredentials> = {}): StoredCredentials => ({
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
  expiresAt: Date.now() + 3600_000,
  scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/calendar'],
  providerAccountId: 'user@example.com',
  ...overrides,
})

describe('InMemoryCredentialStore', () => {
  let store: InMemoryCredentialStore

  beforeEach(() => {
    store = new InMemoryCredentialStore()
  })

  it('returns null when no credentials exist for org+provider+userId', async () => {
    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result).toBeNull()
  })

  it('saves and retrieves credentials', async () => {
    const creds = makeCredentials()
    await store.saveCredentials('org-1', 'gmail', 'user-1', creds)
    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result).toEqual(creds)
  })

  it('returns null after deleting credentials', async () => {
    const creds = makeCredentials()
    await store.saveCredentials('org-1', 'gmail', 'user-1', creds)
    await store.deleteCredentials('org-1', 'gmail', 'user-1')
    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result).toBeNull()
  })

  it('deleting without userId uses __default__ slot', async () => {
    const creds = makeCredentials()
    await store.saveCredentials('org-1', 'gmail', '__default__', creds)
    await store.deleteCredentials('org-1', 'gmail')
    expect(await store.getCredentials('org-1', 'gmail')).toBeNull()
  })

  it('scopes by userId — different userId returns different entry', async () => {
    const creds1 = makeCredentials({ accessToken: 'token-for-user-1' })
    const creds2 = makeCredentials({ accessToken: 'token-for-user-2' })
    await store.saveCredentials('org-1', 'gmail', 'user-1', creds1)
    await store.saveCredentials('org-1', 'gmail', 'user-2', creds2)

    const r1 = await store.getCredentials('org-1', 'gmail', 'user-1')
    const r2 = await store.getCredentials('org-1', 'gmail', 'user-2')
    expect(r1?.accessToken).toBe('token-for-user-1')
    expect(r2?.accessToken).toBe('token-for-user-2')
  })

  it('scopes by organizationId — same provider+userId but different org returns different entries', async () => {
    const credsA = makeCredentials({ accessToken: 'token-org-a' })
    const credsB = makeCredentials({ accessToken: 'token-org-b' })
    await store.saveCredentials('org-a', 'gmail', 'user-1', credsA)
    await store.saveCredentials('org-b', 'gmail', 'user-1', credsB)

    const rA = await store.getCredentials('org-a', 'gmail', 'user-1')
    const rB = await store.getCredentials('org-b', 'gmail', 'user-1')
    expect(rA?.accessToken).toBe('token-org-a')
    expect(rB?.accessToken).toBe('token-org-b')
  })

  it('scopes by provider — gmail and google-calendar are separate namespaces', async () => {
    const gmailCreds = makeCredentials({ accessToken: 'gmail-token' })
    const calCreds = makeCredentials({ accessToken: 'cal-token' })
    await store.saveCredentials('org-1', 'gmail', 'user-1', gmailCreds)
    await store.saveCredentials('org-1', 'google-calendar', 'user-1', calCreds)

    expect((await store.getCredentials('org-1', 'gmail', 'user-1'))?.accessToken).toBe('gmail-token')
    expect((await store.getCredentials('org-1', 'google-calendar', 'user-1'))?.accessToken).toBe('cal-token')
  })

  it('overwrites existing credentials on save', async () => {
    const original = makeCredentials({ accessToken: 'original-token' })
    const updated = makeCredentials({ accessToken: 'updated-token' })
    await store.saveCredentials('org-1', 'gmail', 'user-1', original)
    await store.saveCredentials('org-1', 'gmail', 'user-1', updated)

    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result?.accessToken).toBe('updated-token')
  })

  it('deleting non-existent entry does not throw', async () => {
    await expect(store.deleteCredentials('org-99', 'stripe', 'user-99')).resolves.toBeUndefined()
  })
})
