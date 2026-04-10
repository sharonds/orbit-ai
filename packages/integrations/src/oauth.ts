import { OAuth2Client } from 'google-auth-library'
import type { CredentialStore, StoredCredentials } from './credentials.js'
import { createIntegrationError, isIntegrationError } from './errors.js'

export interface OAuthHelperOptions {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export class GoogleOAuthHelper {
  private readonly oauth2Client: OAuth2Client

  constructor(private readonly options: OAuthHelperOptions) {
    this.oauth2Client = new OAuth2Client(
      options.clientId,
      options.clientSecret,
      options.redirectUri,
    )
  }

  /**
   * Generate the consent URL for the user to authorize.
   */
  createAuthUrl(scopes: string[]): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
    })
  }

  /**
   * Exchange authorization code for tokens and persist via CredentialStore.
   */
  async exchangeCode(
    code: string,
    credentialStore: CredentialStore,
    orgId: string,
    provider: string,
    userId: string,
  ): Promise<StoredCredentials> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code)
      if (!tokens.refresh_token) {
        throw createIntegrationError('AUTH_EXPIRED', 'No refresh token returned. User may need to re-authorize with prompt=consent.', { provider })
      }
      const stored: StoredCredentials = {
        accessToken: tokens.access_token ?? '',
        refreshToken: tokens.refresh_token,
        ...(tokens.expiry_date != null ? { expiresAt: tokens.expiry_date } : {}),
        ...(tokens.scope != null ? { scopes: tokens.scope.split(' ') } : {}),
      }
      await credentialStore.saveCredentials(orgId, provider, userId, stored)
      return stored
    } catch (err) {
      if (isIntegrationError(err)) throw err
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('invalid_grant')) {
        throw createIntegrationError('AUTH_REVOKED', `Invalid grant: ${message}`, { provider, cause: err })
      }
      throw createIntegrationError('PROVIDER_ERROR', `OAuth code exchange failed: ${message}`, { provider, cause: err })
    }
  }

  /**
   * Get a valid access token, refreshing if within 5-minute margin.
   * Implements auth failure tracking: increments failureCount on errors,
   * resets on success, disables at 5 consecutive failures.
   */
  async getValidAccessToken(
    orgId: string,
    provider: string,
    credentialStore: CredentialStore,
    connectionTracker?: ConnectionStatusTracker,
  ): Promise<string> {
    const creds = await credentialStore.getCredentials(orgId, provider)
    if (!creds) {
      throw createIntegrationError('AUTH_EXPIRED', `No credentials found for ${provider}`, { provider })
    }

    const FIVE_MINUTES_MS = 5 * 60 * 1000
    const isExpiringSoon = creds.expiresAt != null && creds.expiresAt < Date.now() + FIVE_MINUTES_MS

    if (!isExpiringSoon && creds.accessToken) {
      return creds.accessToken
    }

    // Need to refresh
    try {
      this.oauth2Client.setCredentials({ refresh_token: creds.refreshToken })
      const { credentials } = await this.oauth2Client.refreshAccessToken()

      const updated: StoredCredentials = {
        ...creds,
        accessToken: credentials.access_token ?? '',
        ...(credentials.expiry_date != null ? { expiresAt: credentials.expiry_date } : {}),
      }
      // Save refreshed credentials (userId not known here — use default)
      await credentialStore.saveCredentials(orgId, provider, '__default__', updated)

      if (connectionTracker) {
        await connectionTracker.recordSuccess(orgId, provider)
      }

      return updated.accessToken
    } catch (err) {
      if (connectionTracker) {
        await connectionTracker.recordFailure(orgId, provider)
      }
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('invalid_grant') || message.includes('Token has been revoked')) {
        throw createIntegrationError('AUTH_REVOKED', `Token refresh failed: ${message}`, { provider, cause: err })
      }
      throw createIntegrationError('AUTH_EXPIRED', `Token refresh failed: ${message}`, { provider, cause: err })
    }
  }

  /**
   * Revoke the token and delete credentials.
   */
  async revokeToken(
    orgId: string,
    provider: string,
    credentialStore: CredentialStore,
  ): Promise<void> {
    const creds = await credentialStore.getCredentials(orgId, provider)
    if (creds?.refreshToken) {
      try {
        await this.oauth2Client.revokeToken(creds.refreshToken)
      } catch (err) {
        console.error('Token revocation failed:', err instanceof Error ? err.message : String(err))
        // Continue to delete local credentials even if revocation fails
      }
    }
    await credentialStore.deleteCredentials(orgId, provider)
  }
}

/**
 * Tracks connection health: failure counts, status transitions.
 * Status progression: active → error (first failure) → disabled (5th failure).
 */
export interface ConnectionStatusTracker {
  recordSuccess(orgId: string, provider: string): Promise<void>
  recordFailure(orgId: string, provider: string): Promise<void>
  getStatus(orgId: string, provider: string): Promise<{ status: string; failureCount: number }>
}

/**
 * In-memory connection tracker for testing.
 */
export class InMemoryConnectionTracker implements ConnectionStatusTracker {
  private readonly state = new Map<string, { status: string; failureCount: number; lastSuccessAt: Date | null; lastFailureAt: Date | null }>()

  private key(orgId: string, provider: string): string {
    return `${orgId}:${provider}`
  }

  async recordSuccess(orgId: string, provider: string): Promise<void> {
    this.state.set(this.key(orgId, provider), {
      status: 'active',
      failureCount: 0,
      lastSuccessAt: new Date(),
      lastFailureAt: this.state.get(this.key(orgId, provider))?.lastFailureAt ?? null,
    })
  }

  async recordFailure(orgId: string, provider: string): Promise<void> {
    const current = this.state.get(this.key(orgId, provider)) ?? {
      status: 'active',
      failureCount: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    }
    const newCount = current.failureCount + 1
    let status = 'error'
    if (newCount >= 5) status = 'disabled'
    this.state.set(this.key(orgId, provider), {
      status,
      failureCount: newCount,
      lastSuccessAt: current.lastSuccessAt,
      lastFailureAt: new Date(),
    })
  }

  async getStatus(orgId: string, provider: string): Promise<{ status: string; failureCount: number }> {
    const s = this.state.get(this.key(orgId, provider))
    return s ? { status: s.status, failureCount: s.failureCount } : { status: 'active', failureCount: 0 }
  }
}
