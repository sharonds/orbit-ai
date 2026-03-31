import type { SQL } from 'drizzle-orm'

export type AdapterName = 'supabase' | 'neon' | 'postgres' | 'sqlite'
export type AdapterDialect = 'postgres' | 'sqlite'

export interface OrbitDatabase {
  transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T>
  execute(statement: SQL): Promise<unknown>
}

export interface OrbitAuthContext {
  userId?: string
  orgId: string
  apiKeyId?: string
  scopes?: string[]
  requestId?: string
}

export interface IUserResolver {
  resolveByExternalAuthId(externalAuthId: string, orgId: string): Promise<string | null>
  upsertFromAuth(input: {
    orgId: string
    externalAuthId: string
    email: string
    name: string
    avatarUrl?: string
  }): Promise<string>
}

export interface ApiKeyAuthLookup {
  id: string
  organizationId: string
  permissions: string[]
  revokedAt: Date | null
  expiresAt: Date | null
}

export interface AdapterAuthorityModel {
  runtimeAuthority: 'request-scoped'
  migrationAuthority: 'elevated'
  requestPathMayUseElevatedCredentials: false
  notes: string[]
}

export const DEFAULT_ADAPTER_AUTHORITY_MODEL: AdapterAuthorityModel = {
  runtimeAuthority: 'request-scoped',
  migrationAuthority: 'elevated',
  requestPathMayUseElevatedCredentials: false,
  notes: [
    'Runtime request paths use least-privilege application credentials.',
    'Migration authority is only available through explicit schema mutation flows.',
    'Request handlers may not use privileged bypass credentials.',
  ],
}

export interface SchemaSnapshot {
  customFields: Array<Record<string, unknown>>
  tables: string[]
}

export interface StorageAdapter {
  readonly name: AdapterName
  readonly dialect: AdapterDialect
  readonly supportsRls: boolean
  readonly supportsBranching: boolean
  readonly supportsJsonbIndexes: boolean
  readonly authorityModel: AdapterAuthorityModel
  readonly database: OrbitDatabase
  readonly users: IUserResolver

  connect(): Promise<void>
  disconnect(): Promise<void>
  migrate(): Promise<void>
  runWithMigrationAuthority<T>(fn: (db: OrbitDatabase) => Promise<T>): Promise<T>
  lookupApiKeyForAuth(keyHash: string): Promise<ApiKeyAuthLookup | null>
  transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T>
  execute(statement: SQL): Promise<unknown>
  withTenantContext<T>(context: OrbitAuthContext, fn: (db: OrbitDatabase) => Promise<T>): Promise<T>
  createBranch?(name: string): Promise<{ id: string; name: string }>
  mergeBranch?(id: string): Promise<void>
  getSchemaSnapshot(): Promise<SchemaSnapshot>
}

export interface PluginSchemaExtension {
  key: string
  tables: string[]
  tenantScopedTables: string[]
  migrations: Array<{
    id: string
    up: string[]
    down: string[]
  }>
  registerObjectTypes?: string[]
}

export interface PluginSchemaRegistry {
  register(extension: PluginSchemaExtension): void
  list(): PluginSchemaExtension[]
}
