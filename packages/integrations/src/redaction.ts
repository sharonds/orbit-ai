/**
 * Redaction utilities for integration provider data.
 * Strips tokens and secrets from error messages and metadata objects.
 */

// Sensitive key patterns — exact boundary match using word boundaries
// Keys like 'authorized_at', 'auth_provider', 'authorization_type' must NOT be redacted
const SENSITIVE_KEY_PATTERN = /^(token|secret|signature|credential|password|private_key|refresh_token|access_token)$/i

/**
 * Check if an object key should be redacted.
 * Uses exact boundary matching — substring matches (e.g. 'authorized_at') are NOT redacted.
 */
export function isSensitiveIntegrationKey(key: string): boolean {
  // Also check camelCase variants
  const camelCaseVariants: string[] = [
    'accessToken', 'refreshToken', 'apiKey', 'clientSecret', 'privateKey',
  ]
  if (camelCaseVariants.includes(key)) return true
  return SENSITIVE_KEY_PATTERN.test(key)
}

/**
 * Strip known token patterns from error messages.
 * Targets specific patterns — does NOT use length-based regex (which would match ULIDs, Gmail message IDs).
 */
export function redactProviderError(message: string): string {
  return message
    // Bearer tokens
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    // Google OAuth access tokens (ya29.*)
    .replace(/ya29\.[A-Za-z0-9_\-]+/g, 'ya29.[REDACTED]')
    // JWTs (eyJ...base64)
    .replace(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*/g, '[JWT_REDACTED]')
    // key=value pairs where key looks sensitive
    .replace(/\b(token|secret|key|password)=[^\s&"']+/gi, '$1=[REDACTED]')
}

/**
 * Recursively sanitize a metadata object, redacting sensitive keys.
 * Must be applied recursively — top-level-only sanitization leaks nested secrets.
 */
export function sanitizeIntegrationMetadata(
  obj: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 10) return {} // prevent infinite recursion on circular structures
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveIntegrationKey(key)) {
      result[key] = '[REDACTED]'
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeIntegrationMetadata(value as Record<string, unknown>, depth + 1)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Convert an IntegrationConnectionRecord row to a sanitized read DTO.
 * Timestamps use .toISOString() — never String() which is locale-dependent.
 */
export function toIntegrationConnectionRead(row: {
  id: string
  organizationId: string
  provider: string
  connectionType: string
  userId: string | null
  status: string
  accessTokenExpiresAt: Date | string | null
  providerAccountId: string | null
  providerWebhookId: string | null
  scopes: string | null
  failureCount: number
  lastSuccessAt: Date | string | null
  lastFailureAt: Date | string | null
  metadata: Record<string, unknown> | null
  createdAt: Date | string
  updatedAt: Date | string
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    connectionType: row.connectionType,
    userId: row.userId,
    status: row.status,
    accessTokenExpiresAt: row.accessTokenExpiresAt instanceof Date
      ? row.accessTokenExpiresAt.toISOString()
      : row.accessTokenExpiresAt,
    providerAccountId: row.providerAccountId,
    providerWebhookId: row.providerWebhookId,
    scopes: row.scopes,
    failureCount: row.failureCount,
    lastSuccessAt: row.lastSuccessAt instanceof Date
      ? row.lastSuccessAt.toISOString()
      : row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt instanceof Date
      ? row.lastFailureAt.toISOString()
      : row.lastFailureAt,
    metadata: row.metadata ? sanitizeIntegrationMetadata(row.metadata) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

export function toIntegrationSyncStateRead(row: {
  id: string
  connectionId: string
  stream: string
  cursor: string | null
  processedEventIds: string[] | null
  lastSyncedAt: Date | string | null
  metadata: Record<string, unknown> | null
  createdAt: Date | string
  updatedAt: Date | string
}) {
  return {
    id: row.id,
    connectionId: row.connectionId,
    stream: row.stream,
    cursor: row.cursor,
    processedEventIds: row.processedEventIds ?? [],
    lastSyncedAt: row.lastSyncedAt instanceof Date
      ? row.lastSyncedAt.toISOString()
      : row.lastSyncedAt,
    metadata: row.metadata ? sanitizeIntegrationMetadata(row.metadata) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}
