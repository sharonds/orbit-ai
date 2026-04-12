import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InMemoryCredentialStore, type StoredCredentials } from '../credentials.js'
import type { IntegrationError } from '../errors.js'
import type { GmailConnectorConfig } from './types.js'

// Mock google-auth-library (same pattern as oauth.test.ts)
const mockGenerateAuthUrl = vi.fn()
const mockGetToken = vi.fn()
const mockSetCredentials = vi.fn()
const mockRefreshAccessToken = vi.fn()

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    setCredentials: mockSetCredentials,
    refreshAccessToken: mockRefreshAccessToken,
  })),
}))

const TEST_CONFIG: GmailConnectorConfig = {
  clientId: 'gmail-client-id',
  clientSecretEnv: 'TEST_GMAIL_SECRET',
  redirectUri: 'http://localhost:3000/callback',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  auto_create_contacts: true,
}

describe('Gmail OAuth helpers', () => {
  let credentialStore: InMemoryCredentialStore

  beforeEach(() => {
    vi.clearAllMocks()
    credentialStore = new InMemoryCredentialStore()
    process.env['TEST_GMAIL_SECRET'] = 'test-secret'
  })

  afterEach(() => {
    delete process.env['TEST_GMAIL_SECRET']
  })

  // Dynamic import to ensure mocks are applied before module load
  async function loadAuth() {
    return import('./auth.js')
  }

  describe('createGmailOAuthHelper', () => {
    it('creates helper with config values', async () => {
      const { createGmailOAuthHelper } = await loadAuth()
      const helper = createGmailOAuthHelper(TEST_CONFIG)
      expect(helper).toBeDefined()
      expect(typeof helper.createAuthUrl).toBe('function')
      expect(typeof helper.exchangeCode).toBe('function')
      expect(typeof helper.getValidAccessToken).toBe('function')
    })

    it('throws when env var is missing', async () => {
      delete process.env['TEST_GMAIL_SECRET']
      const { createGmailOAuthHelper } = await loadAuth()

      expect(() => createGmailOAuthHelper(TEST_CONFIG)).toThrow(
        'Environment variable TEST_GMAIL_SECRET is not set',
      )
    })
  })

  describe('getGmailAuthUrl', () => {
    it('returns a URL containing Gmail scopes', async () => {
      const { getGmailAuthUrl } = await loadAuth()
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/auth?scope=gmail.readonly+gmail.send+gmail.modify',
      )

      const url = getGmailAuthUrl(TEST_CONFIG)

      expect(url).toContain('https://accounts.google.com')
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        prompt: 'consent',
        scope: TEST_CONFIG.scopes,
      })
    })

    it('throws when env var is missing', async () => {
      delete process.env['TEST_GMAIL_SECRET']
      const { getGmailAuthUrl } = await loadAuth()

      expect(() => getGmailAuthUrl(TEST_CONFIG)).toThrow(
        'Environment variable TEST_GMAIL_SECRET is not set',
      )
    })
  })

  describe('completeGmailAuth', () => {
    it('calls exchangeCode with GMAIL_SLUG provider and persists credentials', async () => {
      const { completeGmailAuth } = await loadAuth()
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.gmail-access',
          refresh_token: '1//gmail-refresh',
          expiry_date: 1700000000000,
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
        },
      })

      const result = await completeGmailAuth(
        TEST_CONFIG,
        'auth-code-gmail',
        credentialStore,
        'org-1',
        'user-1',
      )

      expect(result.accessToken).toBe('ya29.gmail-access')
      expect(result.refreshToken).toBe('1//gmail-refresh')
      expect(result.expiresAt).toBe(1700000000000)

      // Verify persisted under 'gmail' provider key
      const saved = await credentialStore.getCredentials('org-1', 'gmail', 'user-1')
      expect(saved).not.toBeNull()
      expect(saved!.refreshToken).toBe('1//gmail-refresh')
    })

    it('throws AUTH_REVOKED on invalid_grant error', async () => {
      const { completeGmailAuth } = await loadAuth()
      mockGetToken.mockRejectedValue(
        new Error('invalid_grant: Token has been expired or revoked'),
      )

      try {
        await completeGmailAuth(TEST_CONFIG, 'bad-code', credentialStore, 'org-1', 'user-1')
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_REVOKED')
        expect(ie.message).toContain('invalid_grant')
      }
    })
  })

  describe('getGmailClient', () => {
    it('returns accessToken from credential store (not expired)', async () => {
      const { getGmailClient } = await loadAuth()
      const creds: StoredCredentials = {
        accessToken: 'ya29.gmail-valid',
        refreshToken: '1//gmail-refresh',
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
      }
      await credentialStore.saveCredentials('org-1', 'gmail', '__default__', creds)

      const client = await getGmailClient(TEST_CONFIG, credentialStore, 'org-1')

      expect(client.accessToken).toBe('ya29.gmail-valid')
      expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    })

    it('refreshes token when expired', async () => {
      const { getGmailClient } = await loadAuth()
      const creds: StoredCredentials = {
        accessToken: 'ya29.gmail-expired',
        refreshToken: '1//gmail-refresh',
        expiresAt: Date.now() - 1000, // already expired
      }
      await credentialStore.saveCredentials('org-1', 'gmail', '__default__', creds)

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'ya29.gmail-refreshed',
          expiry_date: Date.now() + 60 * 60 * 1000,
        },
      })

      const client = await getGmailClient(TEST_CONFIG, credentialStore, 'org-1')

      expect(client.accessToken).toBe('ya29.gmail-refreshed')
      expect(mockSetCredentials).toHaveBeenCalledWith({ refresh_token: '1//gmail-refresh' })
      expect(mockRefreshAccessToken).toHaveBeenCalled()
    })

    it('retrieves user-scoped credentials when userId is provided', async () => {
      const { getGmailClient } = await loadAuth()
      const store = new InMemoryCredentialStore()
      await store.saveCredentials('org_1', 'gmail', 'user_alice', {
        accessToken: 'alice-token',
        refreshToken: 'alice-refresh',
        expiresAt: Date.now() + 3600000,
      })

      const result = await getGmailClient(TEST_CONFIG, store, 'org_1', 'user_alice')
      expect(result.accessToken).toBe('alice-token')
    })
  })
})
