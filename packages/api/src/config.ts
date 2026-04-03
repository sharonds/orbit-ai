import type { StorageAdapter, CoreServices } from '@orbit-ai/core'

export type RuntimeApiAdapter = Omit<StorageAdapter, 'migrate' | 'runWithMigrationAuthority'>

export interface CreateApiOptions {
  adapter: RuntimeApiAdapter
  version: string
  /** Pre-built CoreServices instance. When omitted, createApi will call
   *  createCoreServices(adapter) internally. Useful for testing or when
   *  the caller already has a services instance. */
  services?: CoreServices
}
