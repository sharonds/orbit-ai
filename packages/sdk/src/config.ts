import type {
  DestructiveMigrationEnvironment,
  SchemaMigrationAuthority,
  StorageAdapter,
} from '@orbit-ai/core'

export interface OrbitClientOptions {
  apiKey?: string
  baseUrl?: string
  adapter?: StorageAdapter
  context?: { userId?: string; orgId: string }
  migrationAuthority?: SchemaMigrationAuthority
  destructiveMigrationEnvironment?: DestructiveMigrationEnvironment
  version?: string
  timeoutMs?: number
  maxRetries?: number
}
