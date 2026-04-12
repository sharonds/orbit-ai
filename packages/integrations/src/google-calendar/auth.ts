import { GoogleOAuthHelper } from '../oauth.js'
import type { CredentialStore, StoredCredentials } from '../credentials.js'
import type { CalendarConnectorConfig } from './types.js'
import { CALENDAR_SLUG } from './connector.js'

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
]

/**
 * Create a GoogleOAuthHelper configured for Google Calendar.
 * Resolves the client secret from the environment variable specified in config.
 */
export function createCalendarOAuthHelper(config: CalendarConnectorConfig): GoogleOAuthHelper {
  const clientSecret = process.env[config.clientSecretEnv]
  if (!clientSecret) {
    throw new Error(`Environment variable ${config.clientSecretEnv} is not set`)
  }
  return new GoogleOAuthHelper({
    clientId: config.clientId,
    clientSecret,
    redirectUri: config.redirectUri,
  })
}

/**
 * Get the Google Calendar OAuth consent URL.
 */
export function getCalendarAuthUrl(config: CalendarConnectorConfig): string {
  const helper = createCalendarOAuthHelper(config)
  return helper.createAuthUrl(config.scopes ?? CALENDAR_SCOPES)
}

/**
 * Complete Google Calendar OAuth by exchanging the authorization code for tokens.
 */
export async function completeCalendarAuth(
  config: CalendarConnectorConfig,
  code: string,
  credentialStore: CredentialStore,
  orgId: string,
  userId: string,
): Promise<StoredCredentials> {
  const helper = createCalendarOAuthHelper(config)
  return helper.exchangeCode(code, credentialStore, orgId, CALENDAR_SLUG, userId)
}

/**
 * Get an authenticated Google Calendar API client.
 * Auto-refreshes token if needed.
 */
export async function getCalendarClient(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  userId?: string,
): Promise<{ accessToken: string }> {
  const helper = createCalendarOAuthHelper(config)
  const accessToken = await helper.getValidAccessToken(orgId, CALENDAR_SLUG, credentialStore, undefined, userId)
  return { accessToken }
}
