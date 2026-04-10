import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InMemoryCredentialStore, type StoredCredentials } from '../credentials.js'
import type { IntegrationError } from '../errors.js'
import type { CalendarConnectorConfig } from './types.js'

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

const TEST_CONFIG: CalendarConnectorConfig = {
  clientId: 'calendar-client-id',
  clientSecretEnv: 'TEST_CALENDAR_SECRET',
  redirectUri: 'http://localhost:3000/callback',
  scopes: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
}

describe('Google Calendar OAuth helpers', () => {
  let credentialStore: InMemoryCredentialStore

  beforeEach(() => {
    vi.clearAllMocks()
    credentialStore = new InMemoryCredentialStore()
    process.env['TEST_CALENDAR_SECRET'] = 'test-secret'
  })

  afterEach(() => {
    delete process.env['TEST_CALENDAR_SECRET']
  })

  // Dynamic import to ensure mocks are applied before module load
  async function loadAuth() {
    return import('./auth.js')
  }

  describe('createCalendarOAuthHelper', () => {
    it('creates helper with config values', async () => {
      const { createCalendarOAuthHelper } = await loadAuth()
      const helper = createCalendarOAuthHelper(TEST_CONFIG)
      expect(helper).toBeDefined()
      expect(typeof helper.createAuthUrl).toBe('function')
      expect(typeof helper.exchangeCode).toBe('function')
      expect(typeof helper.getValidAccessToken).toBe('function')
    })

    it('throws when env var is missing', async () => {
      delete process.env['TEST_CALENDAR_SECRET']
      const { createCalendarOAuthHelper } = await loadAuth()

      expect(() => createCalendarOAuthHelper(TEST_CONFIG)).toThrow(
        'Environment variable TEST_CALENDAR_SECRET is not set',
      )
    })
  })

  describe('getCalendarAuthUrl', () => {
    it('returns a URL containing calendar scopes', async () => {
      const { getCalendarAuthUrl } = await loadAuth()
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/auth?scope=calendar.events+calendar.readonly',
      )

      const url = getCalendarAuthUrl(TEST_CONFIG)

      expect(url).toContain('https://accounts.google.com')
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        prompt: 'consent',
        scope: TEST_CONFIG.scopes,
      })
    })

    it('throws when env var is missing', async () => {
      delete process.env['TEST_CALENDAR_SECRET']
      const { getCalendarAuthUrl } = await loadAuth()

      expect(() => getCalendarAuthUrl(TEST_CONFIG)).toThrow(
        'Environment variable TEST_CALENDAR_SECRET is not set',
      )
    })
  })

  describe('completeCalendarAuth', () => {
    it('calls exchangeCode with CALENDAR_SLUG provider and persists credentials', async () => {
      const { completeCalendarAuth } = await loadAuth()
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'ya29.calendar-access',
          refresh_token: '1//calendar-refresh',
          expiry_date: 1700000000000,
          scope: 'https://www.googleapis.com/auth/calendar.events',
        },
      })

      const result = await completeCalendarAuth(
        TEST_CONFIG,
        'auth-code-calendar',
        credentialStore,
        'org-1',
        'user-1',
      )

      expect(result.accessToken).toBe('ya29.calendar-access')
      expect(result.refreshToken).toBe('1//calendar-refresh')
      expect(result.expiresAt).toBe(1700000000000)

      // Verify persisted under 'google-calendar' provider key
      const saved = await credentialStore.getCredentials('org-1', 'google-calendar', 'user-1')
      expect(saved).not.toBeNull()
      expect(saved!.refreshToken).toBe('1//calendar-refresh')
    })

    it('throws AUTH_REVOKED on invalid_grant error', async () => {
      const { completeCalendarAuth } = await loadAuth()
      mockGetToken.mockRejectedValue(
        new Error('invalid_grant: Token has been expired or revoked'),
      )

      try {
        await completeCalendarAuth(TEST_CONFIG, 'bad-code', credentialStore, 'org-1', 'user-1')
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_REVOKED')
        expect(ie.message).toContain('invalid_grant')
      }
    })
  })

  describe('getCalendarClient', () => {
    it('returns accessToken from credential store (not expired)', async () => {
      const { getCalendarClient } = await loadAuth()
      const creds: StoredCredentials = {
        accessToken: 'ya29.calendar-valid',
        refreshToken: '1//calendar-refresh',
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
      }
      await credentialStore.saveCredentials('org-1', 'google-calendar', '__default__', creds)

      const client = await getCalendarClient(TEST_CONFIG, credentialStore, 'org-1')

      expect(client.accessToken).toBe('ya29.calendar-valid')
      expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    })

    it('refreshes token when expired', async () => {
      const { getCalendarClient } = await loadAuth()
      const creds: StoredCredentials = {
        accessToken: 'ya29.calendar-expired',
        refreshToken: '1//calendar-refresh',
        expiresAt: Date.now() - 1000, // already expired
      }
      await credentialStore.saveCredentials('org-1', 'google-calendar', '__default__', creds)

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'ya29.calendar-refreshed',
          expiry_date: Date.now() + 60 * 60 * 1000,
        },
      })

      const client = await getCalendarClient(TEST_CONFIG, credentialStore, 'org-1')

      expect(client.accessToken).toBe('ya29.calendar-refreshed')
      expect(mockSetCredentials).toHaveBeenCalledWith({ refresh_token: '1//calendar-refresh' })
      expect(mockRefreshAccessToken).toHaveBeenCalled()
    })
  })
})
