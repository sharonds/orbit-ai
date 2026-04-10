import { createHash } from 'node:crypto'

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
 * Note: Stripe event-level dedup uses integration_sync_state.processedEventIds
 * instead (see Slice 19 for that implementation).
 */
export class IdempotencyHelper {
  /**
   * Generate a key for this operation. The key is deterministic:
   * same inputs → same key. Useful for provider webhook dedup.
   */
  generateKey(provider: string, operationType: string, resourceId: string): string {
    return generateIdempotencyKey([provider, operationType, resourceId])
  }

  /**
   * Check if a key has been seen. This is a placeholder that will be
   * backed by the core idempotency_keys table when wired in Slice 7+.
   * For now, returns false (not a duplicate) — the actual dedup is
   * implemented at the connector level.
   */
  async check(key: string): Promise<IdempotencyCheckResult> {
    return { isDuplicate: false, key }
  }
}
