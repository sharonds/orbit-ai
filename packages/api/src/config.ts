import type { StorageAdapter } from '@orbit-ai/core'

export type RuntimeApiAdapter = Omit<StorageAdapter, 'migrate' | 'runWithMigrationAuthority'>

export interface CreateApiOptions {
  adapter: RuntimeApiAdapter
  version: string
}
