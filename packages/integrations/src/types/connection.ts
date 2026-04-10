// Read-side DTO types for integration connection and sync state records.
// Note: credentialsEncrypted and refreshTokenEncrypted are NOT exposed in these types.

export interface IntegrationConnectionRecord {
  id: string
  organizationId: string
  provider: string
  connectionType: string
  userId: string | null
  status: string
  providerAccountId: string | null
  providerWebhookId: string | null
  scopes: string | null
  failureCount: number
  lastSuccessAt: string | null // ISO timestamp (.toISOString())
  lastFailureAt: string | null // ISO timestamp (.toISOString())
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface IntegrationSyncStateRecord {
  id: string
  connectionId: string
  stream: string
  cursor: string | null
  processedEventIds: string[] // capped at 1000 entries (FIFO eviction in application code)
  lastSyncedAt: string | null // ISO timestamp (.toISOString())
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
