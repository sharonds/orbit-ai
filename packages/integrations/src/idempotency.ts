import { createHash } from 'node:crypto'
import type { IdempotencyKeyRepository, OrbitAuthContext } from '@orbit-ai/core'
import { generateId } from '@orbit-ai/core'

export interface IdempotencyCheckResult {
  isDuplicate: boolean
  key: string
}

/**
 * Generate a deterministic idempotency key from provider-specific inputs.
 * Uses SHA-256 to create a stable key from the inputs.
 */
export function generateIdempotencyKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 32)
}

/**
 * IdempotencyHelper checks whether an operation with a given key has already
 * been processed. Uses the core idempotency_keys table (already implemented)
 * as the backing store — not a new table or in-memory mechanism.
 *
 * When no repository is injected (e.g. in tests), falls back to always
 * returning isDuplicate: false (backward-compatible no-op).
 *
 * Note: Stripe event-level dedup uses integration_sync_state.processedEventIds
 * instead (see Slice 19 for that implementation).
 */
export class IdempotencyHelper {
  constructor(
    private readonly repository?: IdempotencyKeyRepository,
    private readonly organizationId?: string,
  ) {}

  /**
   * Generate a key for this operation. The key is deterministic:
   * same inputs → same key. Useful for provider webhook dedup.
   */
  generateKey(provider: string, operationType: string, resourceId: string): string {
    return generateIdempotencyKey([provider, operationType, resourceId])
  }

  /**
   * Check if a key has been seen. Queries the core idempotency_keys table.
   * If no repository is injected, returns isDuplicate: false (test/no-op path).
   */
  async check(key: string): Promise<IdempotencyCheckResult> {
    if (!this.repository || !this.organizationId) {
      // No repository injected — callers must inject one for real dedup.
      // This path is only acceptable in tests via InMemoryCredentialStore pattern.
      return { isDuplicate: false, key }
    }
    try {
      const ctx: OrbitAuthContext = { orgId: this.organizationId }
      const result = await this.repository.list(ctx, {
        filter: { key },
        limit: 1,
      })
      return { isDuplicate: result.data.length > 0, key }
    } catch (err) {
      console.error(
        'IdempotencyHelper.check failed:',
        err instanceof Error ? err.message : String(err),
      )
      return { isDuplicate: false, key }
    }
  }

  /**
   * Record that a key has been processed. Creates an entry in the core
   * idempotency_keys table. If no repository is injected, this is a no-op.
   */
  async record(key: string): Promise<void> {
    if (!this.repository || !this.organizationId) return
    try {
      const ctx: OrbitAuthContext = { orgId: this.organizationId }
      const now = new Date()
      await this.repository.create(ctx, {
        id: generateId('idempotencyKey'),
        organizationId: this.organizationId,
        key,
        method: 'INTEGRATION',
        path: '/integration/dedup',
        requestHash: key,
        responseCode: null,
        responseBody: null,
        lockedUntil: null,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    } catch (err) {
      console.error(
        'IdempotencyHelper.record failed:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}
