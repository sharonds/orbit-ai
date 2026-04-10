import { GoogleOAuthHelper } from '../oauth.js'
import type { CredentialStore, StoredCredentials } from '../credentials.js'
import type { GmailConnectorConfig } from './types.js'
import { GMAIL_SLUG } from './connector.js'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

/**
 * Create a GoogleOAuthHelper configured for Gmail.
 * Resolves the client secret from the environment variable specified in config.
 */
export function createGmailOAuthHelper(config: GmailConnectorConfig): GoogleOAuthHelper {
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
 * Get the Gmail OAuth consent URL.
 */
export function getGmailAuthUrl(config: GmailConnectorConfig): string {
  const helper = createGmailOAuthHelper(config)
  return helper.createAuthUrl(config.scopes ?? GMAIL_SCOPES)
}

/**
 * Complete Gmail OAuth by exchanging the authorization code for tokens.
 */
export async function completeGmailAuth(
  config: GmailConnectorConfig,
  code: string,
  credentialStore: CredentialStore,
  orgId: string,
  userId: string,
): Promise<StoredCredentials> {
  const helper = createGmailOAuthHelper(config)
  return helper.exchangeCode(code, credentialStore, orgId, GMAIL_SLUG, userId)
}

/**
 * Get an authenticated Gmail API client (googleapis).
 * Auto-refreshes token if needed.
 */
export async function getGmailClient(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
): Promise<{ accessToken: string }> {
  const helper = createGmailOAuthHelper(config)
  const accessToken = await helper.getValidAccessToken(orgId, GMAIL_SLUG, credentialStore)
  return { accessToken }
}
