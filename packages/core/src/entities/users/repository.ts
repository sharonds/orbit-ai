import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteBoolean,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteBoolean,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { userRecordSchema, type UserRecord } from './validators.js'

export interface UserRepository {
  create(record: UserRecord): Promise<UserRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<UserRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<UserRecord>): Promise<UserRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<UserRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<UserRecord>>
}

export function createInMemoryUserRepository(seed: UserRecord[] = []): UserRepository {
  const rows = new Map(seed.map((record) => [record.id, userRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): UserRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(record) {
      const parsed = userRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async update(ctx, id, patch) {
      const current = await this.get(ctx, id)
      if (!current) {
        return null
      }

      const next = userRecordSchema.parse({
        ...current,
        ...patch,
      })
      rows.set(id, next)
      return next
    },
    async delete(ctx, id) {
      const current = await this.get(ctx, id)
      if (!current) {
        return false
      }

      rows.delete(id)
      return true
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['email', 'name', 'role', 'external_auth_id'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['email', 'name', 'role', 'external_auth_id'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteUserRepository(adapter: StorageAdapter): UserRepository {
  return createTenantSqliteRepository<UserRecord>(adapter, {
    tableName: 'users',
    columns: [
      'id',
      'organization_id',
      'email',
      'name',
      'role',
      'avatar_url',
      'external_auth_id',
      'is_active',
      'metadata',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['email', 'name', 'role', 'external_auth_id'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        email: record.email,
        name: record.name,
        role: record.role,
        avatar_url: record.avatarUrl,
        external_auth_id: record.externalAuthId,
        is_active: toSqliteBoolean(record.isActive),
        metadata: toSqliteJson(record.metadata),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return userRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
        name: row.name,
        role: row.role,
        avatarUrl: row.avatar_url ?? null,
        externalAuthId: row.external_auth_id ?? null,
        isActive: fromSqliteBoolean(row.is_active),
        metadata: fromSqliteJson(row.metadata, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}
