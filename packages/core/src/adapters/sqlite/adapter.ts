import { assertOrbitId } from '../../ids/parse-id.js'
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

const defaultUserResolver: IUserResolver = {
  async resolveByExternalAuthId() {
    return null
  },
  async upsertFromAuth() {
    throw new Error('SQLite adapter user resolver not configured')
  },
}

export interface SqliteStorageAdapterConfig {
  database: OrbitDatabase
  migrationDatabase?: MigrationDatabase
  users?: IUserResolver
  lookupApiKeyForAuth?(keyHash: string): Promise<ApiKeyAuthLookup | null>
  connect?(): Promise<void>
  disconnect?(): Promise<void>
  migrate?(): Promise<void>
  getSchemaSnapshot?(): Promise<SchemaSnapshot>
}

export class SqliteStorageAdapter implements StorageAdapter {
  readonly name = 'sqlite' as const
  readonly dialect = 'sqlite' as const
  readonly supportsRls = false
  readonly supportsBranching = false
  readonly supportsJsonbIndexes = false
  readonly authorityModel = DEFAULT_ADAPTER_AUTHORITY_MODEL
  readonly unsafeRawDatabase: OrbitDatabase
  readonly users: IUserResolver

  private readonly migrationDatabase: MigrationDatabase
  private readonly lookupApiKey: NonNullable<SqliteStorageAdapterConfig['lookupApiKeyForAuth']>
  private readonly connectImpl: NonNullable<SqliteStorageAdapterConfig['connect']>
  private readonly disconnectImpl: NonNullable<SqliteStorageAdapterConfig['disconnect']>
  private readonly migrateImpl: NonNullable<SqliteStorageAdapterConfig['migrate']>
  private readonly getSchemaSnapshotImpl: NonNullable<SqliteStorageAdapterConfig['getSchemaSnapshot']>

  constructor(config: SqliteStorageAdapterConfig) {
    this.unsafeRawDatabase = config.database
    this.migrationDatabase = config.migrationDatabase ?? asMigrationDatabase(config.database)
    this.users = config.users ?? defaultUserResolver
    this.lookupApiKey = config.lookupApiKeyForAuth ?? (async () => null)
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
    return this.lookupApiKey(keyHash)
  }

  async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T> {
    return this.unsafeRawDatabase.transaction(fn)
  }

  async execute(statement: Parameters<OrbitDatabase['execute']>[0]): Promise<unknown> {
    return this.unsafeRawDatabase.execute(statement)
  }

  async withTenantContext<T>(context: OrbitAuthContext, fn: (db: OrbitDatabase) => Promise<T>): Promise<T> {
    assertOrbitId(context.orgId, 'organization')
    return this.transaction(fn)
  }

  async getSchemaSnapshot(): Promise<SchemaSnapshot> {
    return this.getSchemaSnapshotImpl()
  }
}

export function createSqliteStorageAdapter(config: SqliteStorageAdapterConfig): SqliteStorageAdapter {
  return new SqliteStorageAdapter(config)
}
