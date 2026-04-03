import type { StorageAdapter } from '@orbit-ai/core'

export interface OrbitClientOptions {
  apiKey?: string
  baseUrl?: string
  adapter?: StorageAdapter
  context?: { userId?: string; orgId: string }
  version?: string
  timeoutMs?: number
  maxRetries?: number
}
