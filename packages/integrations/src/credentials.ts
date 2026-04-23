import { randomUUID } from 'node:crypto'

import { sql } from 'drizzle-orm'
import type { StorageAdapter } from '@orbit-ai/core'

import type { EncryptionProvider } from './encryption.js'

export interface StoredCredentials {
  accessToken: string
  refreshToken: string
  expiresAt?: number      // epoch millis
  scopes?: string[]
  providerAccountId?: string
}

export interface CredentialStore {
  getCredentials(organizationId: string, provider: string, userId?: string): Promise<StoredCredentials | null>
  saveCredentials(organizationId: string, provider: string, userId: string, credentials: StoredCredentials): Promise<void>
  deleteCredentials(organizationId: string, provider: string, userId?: string): Promise<void>
}

/**
 * In-memory credential store — for testing only.
 */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly store = new Map<string, StoredCredentials>()

  private key(orgId: string, provider: string, userId?: string): string {
    return `${orgId}:${provider}:${userId ?? '__default__'}`
  }

  async getCredentials(orgId: string, provider: string, userId?: string): Promise<StoredCredentials | null> {
    return this.store.get(this.key(orgId, provider, userId)) ?? null
  }

  async saveCredentials(orgId: string, provider: string, userId: string, credentials: StoredCredentials): Promise<void> {
    this.store.set(this.key(orgId, provider, userId), credentials)
  }

  async deleteCredentials(orgId: string, provider: string, userId?: string): Promise<void> {
    this.store.delete(this.key(orgId, provider, userId))
  }
}

interface IntegrationConnectionRow extends Record<string, unknown> {
  credentials_encrypted: string | null
  refresh_token_encrypted: string | null
  access_token_expires_at: string | null
  scopes: string | null
  provider_account_id: string | null
}

interface DecryptedCredentialsPayload {
  accessToken: string
  providerAccountId?: string
}

/**
 * Production credential store backed by the integration_connections table.
 *
 * Encrypts access-token payload (JSON) and refresh token via the supplied
 * EncryptionProvider. The refresh token lives in its own column so rotations
 * can be audited independently of the rest of the credential blob.
 */
export class TableBackedCredentialStore implements CredentialStore {
  constructor(
    private readonly db: StorageAdapter,
    private readonly encryption: EncryptionProvider,
  ) {}

  async getCredentials(orgId: string, provider: string, userId?: string): Promise<StoredCredentials | null> {
    try {
      const rows = userId === undefined
        ? await this.db.unsafeRawDatabase.query<IntegrationConnectionRow>(sql`
            SELECT credentials_encrypted, refresh_token_encrypted, access_token_expires_at, scopes, provider_account_id
            FROM integration_connections
            WHERE organization_id = ${orgId} AND provider = ${provider} AND user_id IS NULL
            LIMIT 1
          `)
        : await this.db.unsafeRawDatabase.query<IntegrationConnectionRow>(sql`
            SELECT credentials_encrypted, refresh_token_encrypted, access_token_expires_at, scopes, provider_account_id
            FROM integration_connections
            WHERE organization_id = ${orgId} AND provider = ${provider} AND user_id = ${userId}
            LIMIT 1
          `)

      const row = rows[0]
      if (!row) return null
      if (!row.credentials_encrypted || !row.refresh_token_encrypted) return null

      const credsJson = await this.encryption.decrypt(row.credentials_encrypted)
      const refreshToken = await this.encryption.decrypt(row.refresh_token_encrypted)
      const payload = JSON.parse(credsJson) as DecryptedCredentialsPayload

      const result: StoredCredentials = {
        accessToken: payload.accessToken,
        refreshToken,
      }
      if (payload.providerAccountId) result.providerAccountId = payload.providerAccountId
      if (row.provider_account_id && !result.providerAccountId) {
        result.providerAccountId = row.provider_account_id
      }
      if (row.scopes) {
        result.scopes = row.scopes.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      }
      if (row.access_token_expires_at) {
        const ms = Date.parse(row.access_token_expires_at)
        if (!Number.isNaN(ms)) result.expiresAt = ms
      }
      return result
    } catch (err) {
      console.error(`[TableBackedCredentialStore] getCredentials failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  async saveCredentials(orgId: string, provider: string, userId: string, credentials: StoredCredentials): Promise<void> {
    try {
      const payload: DecryptedCredentialsPayload = { accessToken: credentials.accessToken }
      if (credentials.providerAccountId) payload.providerAccountId = credentials.providerAccountId

      const credentialsEncrypted = await this.encryption.encrypt(JSON.stringify(payload))
      const refreshEncrypted = await this.encryption.encrypt(credentials.refreshToken)
      const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt).toISOString() : null
      const scopesCsv = credentials.scopes && credentials.scopes.length > 0 ? credentials.scopes.join(',') : null
      const providerAccountId = credentials.providerAccountId ?? null
      const id = randomUUID()
      const now = new Date().toISOString()

      await this.db.unsafeRawDatabase.execute(sql`
        INSERT INTO integration_connections (
          id, organization_id, provider, connection_type, user_id, status,
          credentials_encrypted, refresh_token_encrypted, access_token_expires_at,
          provider_account_id, scopes, failure_count, created_at, updated_at
        ) VALUES (
          ${id}, ${orgId}, ${provider}, 'oauth2', ${userId}, 'active',
          ${credentialsEncrypted}, ${refreshEncrypted}, ${expiresAt},
          ${providerAccountId}, ${scopesCsv}, 0, ${now}, ${now}
        )
        ON CONFLICT(organization_id, provider, user_id) DO UPDATE SET
          credentials_encrypted = excluded.credentials_encrypted,
          refresh_token_encrypted = excluded.refresh_token_encrypted,
          access_token_expires_at = excluded.access_token_expires_at,
          provider_account_id = excluded.provider_account_id,
          scopes = excluded.scopes,
          status = 'active',
          updated_at = excluded.updated_at
      `)
    } catch (err) {
      console.error(`[TableBackedCredentialStore] saveCredentials failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  async deleteCredentials(orgId: string, provider: string, userId?: string): Promise<void> {
    try {
      if (userId === undefined) {
        await this.db.unsafeRawDatabase.execute(sql`
          DELETE FROM integration_connections
          WHERE organization_id = ${orgId} AND provider = ${provider} AND user_id IS NULL
        `)
      } else {
        await this.db.unsafeRawDatabase.execute(sql`
          DELETE FROM integration_connections
          WHERE organization_id = ${orgId} AND provider = ${provider} AND user_id = ${userId}
        `)
      }
    } catch (err) {
      console.error(`[TableBackedCredentialStore] deleteCredentials failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }
}
