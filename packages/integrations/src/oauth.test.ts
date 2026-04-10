import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleOAuthHelper, InMemoryConnectionTracker } from './oauth.js'
import { InMemoryCredentialStore, type StoredCredentials } from './credentials.js'
import type { IntegrationError } from './errors.js'

// Mock google-auth-library
const mockGenerateAuthUrl = vi.fn()
const mockGetToken = vi.fn()
const mockSetCredentials = vi.fn()
const mockRefreshAccessToken = vi.fn()
const mockRevokeToken = vi.fn()

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    setCredentials: mockSetCredentials,
    refreshAccessToken: mockRefreshAccessToken,
    revokeToken: mockRevokeToken,
  })),
}))

const OPTIONS = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/callback',
}

describe('GoogleOAuthHelper', () => {
  let helper: GoogleOAuthHelper
  let credentialStore: InMemoryCredentialStore

  beforeEach(() => {
    vi.clearAllMocks()
    helper = new GoogleOAuthHelper(OPTIONS)
    credentialStore = new InMemoryCredentialStore()
  })

  describe('createAuthUrl', () => {
    it('includes expected scopes and access_type=offline', () => {
      const scopes = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar']
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?scope=...')

      const url = helper.createAuthUrl(scopes)

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
      })
      expect(url).toBe('https://accounts.google.com/o/oauth2/auth?scope=...')
    })
  })

  describe('exchangeCode', () => {
    it('stores credentials via CredentialStore on success', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access-token',
          refresh_token: '1//refresh-token',
          expiry_date: 1700000000000,
          scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar',
        },
      })

      const result = await helper.exchangeCode('auth-code-123', credentialStore, 'org-1', 'google', 'user-1')

      expect(result.accessToken).toBe('ya29.access-token')
      expect(result.refreshToken).toBe('1//refresh-token')
      expect(result.expiresAt).toBe(1700000000000)
      expect(result.scopes).toEqual([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
      ])

      // Verify stored in credential store
      const saved = await credentialStore.getCredentials('org-1', 'google', 'user-1')
      expect(saved).not.toBeNull()
      expect(saved!.refreshToken).toBe('1//refresh-token')
    })

    it('throws AUTH_REVOKED on invalid_grant error', async () => {
      mockGetToken.mockRejectedValue(new Error('invalid_grant: Token has been expired or revoked'))

      try {
        await helper.exchangeCode('bad-code', credentialStore, 'org-1', 'google', 'user-1')
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_REVOKED')
        expect(ie.message).toContain('invalid_grant')
      }
    })

    it('throws AUTH_EXPIRED when no refresh token returned', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.access-token',
          refresh_token: null,
          expiry_date: 1700000000000,
          scope: 'email',
        },
      })

      try {
        await helper.exchangeCode('code-no-refresh', credentialStore, 'org-1', 'google', 'user-1')
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_EXPIRED')
        expect(ie.message).toContain('No refresh token returned')
      }
    })

    it('throws PROVIDER_ERROR for unknown exchange errors', async () => {
      mockGetToken.mockRejectedValue(new Error('Network timeout'))

      try {
        await helper.exchangeCode('code', credentialStore, 'org-1', 'google', 'user-1')
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('PROVIDER_ERROR')
        expect(ie.message).toContain('Network timeout')
      }
    })
  })

  describe('getValidAccessToken', () => {
    it('returns cached token when not expired', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.still-valid',
        refreshToken: '1//refresh',
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)

      const token = await helper.getValidAccessToken('org-1', 'google', credentialStore)

      expect(token).toBe('ya29.still-valid')
      expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    })

    it('refreshes when token expires within 5-minute margin', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.expiring-soon',
        refreshToken: '1//refresh',
        expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now (< 5 min margin)
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'ya29.refreshed-token',
          expiry_date: Date.now() + 60 * 60 * 1000,
        },
      })

      const token = await helper.getValidAccessToken('org-1', 'google', credentialStore)

      expect(token).toBe('ya29.refreshed-token')
      expect(mockSetCredentials).toHaveBeenCalledWith({ refresh_token: '1//refresh' })
      expect(mockRefreshAccessToken).toHaveBeenCalled()
    })

    it('throws AUTH_EXPIRED when no credentials found', async () => {
      try {
        await helper.getValidAccessToken('org-1', 'google', credentialStore)
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_EXPIRED')
        expect(ie.message).toContain('No credentials found')
      }
    })

    it('throws AUTH_REVOKED on "Token has been revoked" error', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.old',
        refreshToken: '1//refresh',
        expiresAt: Date.now() - 1000, // already expired
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)

      mockRefreshAccessToken.mockRejectedValue(new Error('Token has been revoked'))

      try {
        await helper.getValidAccessToken('org-1', 'google', credentialStore)
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_REVOKED')
        expect(ie.message).toContain('Token has been revoked')
      }
    })

    it('calls connectionTracker.recordSuccess on refresh success', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.expiring',
        refreshToken: '1//refresh',
        expiresAt: Date.now() - 1000, // expired
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'ya29.new-token',
          expiry_date: Date.now() + 3600000,
        },
      })

      const tracker = new InMemoryConnectionTracker()
      await helper.getValidAccessToken('org-1', 'google', credentialStore, tracker)

      const status = await tracker.getStatus('org-1', 'google')
      expect(status.status).toBe('active')
      expect(status.failureCount).toBe(0)
    })

    it('persists refreshed token so second call uses cache without re-refreshing', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.expiring',
        refreshToken: '1//refresh',
        expiresAt: Date.now() - 1000, // expired
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)

      const futureExpiry = Date.now() + 60 * 60 * 1000
      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'ya29.durable-token',
          expiry_date: futureExpiry,
        },
      })

      // First call triggers refresh
      const token1 = await helper.getValidAccessToken('org-1', 'google', credentialStore)
      expect(token1).toBe('ya29.durable-token')
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1)

      // Second call should use cached token — no additional refresh
      const token2 = await helper.getValidAccessToken('org-1', 'google', credentialStore)
      expect(token2).toBe('ya29.durable-token')
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1) // still 1, not 2
    })

    it('calls connectionTracker.recordFailure on refresh failure', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.expiring',
        refreshToken: '1//refresh',
        expiresAt: Date.now() - 1000,
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)

      mockRefreshAccessToken.mockRejectedValue(new Error('Some refresh error'))

      const tracker = new InMemoryConnectionTracker()
      try {
        await helper.getValidAccessToken('org-1', 'google', credentialStore, tracker)
      } catch (err) {
        // expected
      }

      const status = await tracker.getStatus('org-1', 'google')
      expect(status.status).toBe('error')
      expect(status.failureCount).toBe(1)
    })
  })

  describe('revokeToken', () => {
    it('calls revokeToken on OAuth2Client and deletes credentials', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.token',
        refreshToken: '1//refresh-to-revoke',
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)
      mockRevokeToken.mockResolvedValue(undefined)

      await helper.revokeToken('org-1', 'google', credentialStore)

      expect(mockRevokeToken).toHaveBeenCalledWith('1//refresh-to-revoke')
      const saved = await credentialStore.getCredentials('org-1', 'google')
      expect(saved).toBeNull()
    })

    it('deletes credentials even if revocation fails (non-throwing)', async () => {
      const creds: StoredCredentials = {
        accessToken: 'ya29.token',
        refreshToken: '1//refresh-fail',
      }
      await credentialStore.saveCredentials('org-1', 'google', '__default__', creds)
      mockRevokeToken.mockRejectedValue(new Error('Google API unreachable'))

      // Should NOT throw
      await helper.revokeToken('org-1', 'google', credentialStore)

      const saved = await credentialStore.getCredentials('org-1', 'google')
      expect(saved).toBeNull()
    })
  })
})

describe('InMemoryConnectionTracker', () => {
  it('status progression: active → error → disabled at 5 failures', async () => {
    const tracker = new InMemoryConnectionTracker()

    // Default is active
    let status = await tracker.getStatus('org-1', 'google')
    expect(status).toEqual({ status: 'active', failureCount: 0 })

    // First failure → error
    await tracker.recordFailure('org-1', 'google')
    status = await tracker.getStatus('org-1', 'google')
    expect(status).toEqual({ status: 'error', failureCount: 1 })

    // Failures 2-4 stay at error
    await tracker.recordFailure('org-1', 'google')
    await tracker.recordFailure('org-1', 'google')
    await tracker.recordFailure('org-1', 'google')
    status = await tracker.getStatus('org-1', 'google')
    expect(status).toEqual({ status: 'error', failureCount: 4 })

    // 5th failure → disabled
    await tracker.recordFailure('org-1', 'google')
    status = await tracker.getStatus('org-1', 'google')
    expect(status).toEqual({ status: 'disabled', failureCount: 5 })
  })

  it('resets on success', async () => {
    const tracker = new InMemoryConnectionTracker()

    // Record some failures
    await tracker.recordFailure('org-1', 'google')
    await tracker.recordFailure('org-1', 'google')
    await tracker.recordFailure('org-1', 'google')
    let status = await tracker.getStatus('org-1', 'google')
    expect(status.failureCount).toBe(3)

    // Success resets
    await tracker.recordSuccess('org-1', 'google')
    status = await tracker.getStatus('org-1', 'google')
    expect(status).toEqual({ status: 'active', failureCount: 0 })
  })
})
