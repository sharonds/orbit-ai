import type { StorageAdapter, CoreServices } from '@orbit-ai/core'
import type { IdempotencyStore } from './middleware/idempotency.js'

export type RuntimeApiAdapter = Omit<StorageAdapter, 'migrate' | 'runWithMigrationAuthority'>

export interface CreateApiOptions {
  adapter: RuntimeApiAdapter
  version: string
  /** Pre-built CoreServices instance. When omitted, createApi will call
   *  createCoreServices(adapter) internally. Useful for testing or when
   *  the caller already has a services instance. */
  services?: CoreServices
  /**
   * Maximum HTTP request body size in bytes. Defaults to 1 MB (1_048_576).
   * Exceeding this returns 413 Payload Too Large before any parsing.
   */
  maxRequestBodySize?: number
  /**
   * Custom idempotency store. If omitted, a single-instance in-memory store
   * is used (MemoryIdempotencyStore). For multi-instance deployments you MUST
   * provide a custom implementation, otherwise idempotency silently fails
   * across instances.
   */
  idempotencyStore?: IdempotencyStore
}
