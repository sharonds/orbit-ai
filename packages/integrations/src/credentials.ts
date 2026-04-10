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

/**
 * Production credential store backed by the integration_connections table.
 * Encrypts refreshToken and credentials before writing; decrypts on read.
 * Full implementation wired in Slice 7+ when the db adapter interface is available.
 */
export class TableBackedCredentialStore implements CredentialStore {
  constructor(
    private readonly db: unknown,   // core storage adapter — typed as unknown to avoid circular deps
    private readonly encryption: EncryptionProvider,
  ) {}

  async getCredentials(_orgId: string, _provider: string, _userId?: string): Promise<StoredCredentials | null> {
    // Implementation: query integration_connections for org+provider+userId
    // Return null if not found; decrypt on read
    // Note: full implementation requires db query interface — this is a stub
    // that will be wired up when the adapter is integrated in Slice 7+
    throw new Error('TableBackedCredentialStore requires database integration — use InMemoryCredentialStore in tests')
  }

  async saveCredentials(_orgId: string, _provider: string, _userId: string, _credentials: StoredCredentials): Promise<void> {
    throw new Error('TableBackedCredentialStore requires database integration — use InMemoryCredentialStore in tests')
  }

  async deleteCredentials(_orgId: string, _provider: string, _userId?: string): Promise<void> {
    throw new Error('TableBackedCredentialStore requires database integration — use InMemoryCredentialStore in tests')
  }
}
