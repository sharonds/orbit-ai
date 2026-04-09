import type { OrbitClient } from '@orbit-ai/sdk'

export type OutputFormat = 'table' | 'json' | 'csv' | 'tsv'

export interface GlobalFlags {
  json?: boolean
  format?: OutputFormat
  apiKey?: string
  baseUrl?: string
  orgId?: string
  userId?: string
  databaseUrl?: string
  adapter?: string
  mode?: 'api' | 'direct'
  profile?: string
  quiet?: boolean
  yes?: boolean
}

export interface ResolvedContext {
  client: OrbitClient
  flags: GlobalFlags
  format: OutputFormat
}
