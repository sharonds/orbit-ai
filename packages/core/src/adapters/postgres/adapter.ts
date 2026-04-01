import { sql } from 'drizzle-orm'

import {
  DEFAULT_ADAPTER_AUTHORITY_MODEL,
  asMigrationDatabase,
  type ApiKeyAuthLookup,
  type MigrationDatabase,
  type OrbitAuthContext,
  type OrbitDatabase,
  type SchemaSnapshot,
  type StorageAdapter,
  type IUserResolver,
} from '../interface.js'
import { withTenantContext } from './tenant-context.js'
import { fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'

const defaultUserResolver: IUserResolver = {
  async resolveByExternalAuthId() {
    return null
  },
  async upsertFromAuth() {
    throw new Error('Postgres adapter user resolver not configured')
  },
}

export interface PostgresStorageAdapterConfig {
  database: OrbitDatabase
  migrationDatabase?: MigrationDatabase
  users?: IUserResolver
  connect?(): Promise<void>
  disconnect?(): Promise<void>
  migrate?(): Promise<void>
  getSchemaSnapshot?(): Promise<SchemaSnapshot>
}

export class PostgresStorageAdapter implements StorageAdapter {
  readonly name = 'postgres' as const
  readonly dialect = 'postgres' as const
  readonly supportsRls = true
  readonly supportsBranching = false
  readonly supportsJsonbIndexes = true
  readonly authorityModel = DEFAULT_ADAPTER_AUTHORITY_MODEL
  readonly unsafeRawDatabase: OrbitDatabase
  readonly users: IUserResolver

  private readonly migrationDatabase: MigrationDatabase
  private readonly connectImpl: NonNullable<PostgresStorageAdapterConfig['connect']>
  private readonly disconnectImpl: NonNullable<PostgresStorageAdapterConfig['disconnect']>
  private readonly migrateImpl: NonNullable<PostgresStorageAdapterConfig['migrate']>
  private readonly getSchemaSnapshotImpl: NonNullable<PostgresStorageAdapterConfig['getSchemaSnapshot']>

  constructor(config: PostgresStorageAdapterConfig) {
    this.unsafeRawDatabase = config.database
    this.migrationDatabase = config.migrationDatabase ?? asMigrationDatabase(config.database)
    this.users = config.users ?? defaultUserResolver
    this.connectImpl = config.connect ?? (async () => undefined)
    this.disconnectImpl = config.disconnect ?? (async () => undefined)
    this.migrateImpl = config.migrate ?? (async () => undefined)
    this.getSchemaSnapshotImpl =
      config.getSchemaSnapshot ??
      (async () => ({
        customFields: [],
        tables: [],
      }))
  }

  async connect(): Promise<void> {
    await this.connectImpl()
  }

  async disconnect(): Promise<void> {
    await this.disconnectImpl()
  }

  async migrate(): Promise<void> {
    await this.migrateImpl()
  }

  async runWithMigrationAuthority<T>(fn: (db: MigrationDatabase) => Promise<T>): Promise<T> {
    return fn(this.migrationDatabase)
  }

  async lookupApiKeyForAuth(keyHash: string): Promise<ApiKeyAuthLookup | null> {
    const rows = await this.unsafeRawDatabase.query<Record<string, unknown>>(
      sql`select id, organization_id, scopes, revoked_at, expires_at from api_keys where key_hash = ${keyHash} limit 1`,
    )
    const row = rows[0]

    if (!row) {
      return null
    }

    return {
      id: String(row.id),
      organizationId: String(row.organization_id),
      scopes: fromPostgresJson(row.scopes, []).map(String),
      revokedAt: fromPostgresDate(row.revoked_at),
      expiresAt: fromPostgresDate(row.expires_at),
    }
  }

  async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T> {
    return this.unsafeRawDatabase.transaction(fn)
  }

  async execute(statement: Parameters<OrbitDatabase['execute']>[0]): Promise<unknown> {
    return this.unsafeRawDatabase.execute(statement)
  }

  async query<T extends Record<string, unknown>>(statement: Parameters<OrbitDatabase['query']>[0]): Promise<T[]> {
    return this.unsafeRawDatabase.query<T>(statement)
  }

  async withTenantContext<T>(context: OrbitAuthContext, fn: (db: OrbitDatabase) => Promise<T>): Promise<T> {
    return withTenantContext(this.unsafeRawDatabase, context, fn)
  }

  async getSchemaSnapshot(): Promise<SchemaSnapshot> {
    return this.getSchemaSnapshotImpl()
  }
}

export function createPostgresStorageAdapter(
  config: PostgresStorageAdapterConfig,
): PostgresStorageAdapter {
  return new PostgresStorageAdapter(config)
}
