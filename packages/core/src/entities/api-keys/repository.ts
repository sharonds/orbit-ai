import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { apiKeyRecordSchema, type ApiKeyRecord } from './validators.js'

export interface ApiKeyRepository {
  create(ctx: OrbitAuthContext, record: ApiKeyRecord): Promise<ApiKeyRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ApiKeyRecord | null>
  getAny(id: string): Promise<ApiKeyRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<ApiKeyRecord>): Promise<ApiKeyRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ApiKeyRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ApiKeyRecord>>
  listAll(query: SearchQuery): Promise<InternalPaginatedResult<ApiKeyRecord>>
}

export function createInMemoryApiKeyRepository(seed: ApiKeyRecord[] = []): ApiKeyRepository {
  const rows = new Map(seed.map((record) => [record.id, apiKeyRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): ApiKeyRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  function allRows(): ApiKeyRecord[] {
    return [...rows.values()]
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('API key organization mismatch')
      }

      const parsed = apiKeyRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async getAny(id) {
      return rows.get(id) ?? null
    },
    async update(ctx, id, patch) {
      const current = await this.get(ctx, id)
      if (!current) {
        return null
      }

      const next = apiKeyRecordSchema.parse({
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
        searchableFields: ['name', 'key_prefix'],
        filterableFields: [
          'id',
          'organization_id',
          'name',
          'scopes',
          'last_used_at',
          'expires_at',
          'revoked_at',
          'created_by_user_id',
        ],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'key_prefix'],
        filterableFields: [
          'id',
          'organization_id',
          'name',
          'scopes',
          'last_used_at',
          'expires_at',
          'revoked_at',
          'created_by_user_id',
        ],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async listAll(query) {
      return runArrayQuery(allRows(), query, {
        searchableFields: ['name', 'key_prefix'],
        filterableFields: [
          'id',
          'organization_id',
          'name',
          'scopes',
          'last_used_at',
          'expires_at',
          'revoked_at',
          'created_by_user_id',
        ],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteApiKeyRepository(adapter: StorageAdapter): ApiKeyRepository {
  const base = createTenantSqliteRepository<ApiKeyRecord>(adapter, {
    tableName: 'api_keys',
    columns: [
      'id',
      'organization_id',
      'name',
      'key_hash',
      'key_prefix',
      'scopes',
      'last_used_at',
      'expires_at',
      'revoked_at',
      'created_by_user_id',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['name', 'key_prefix'],
    filterableFields: [
      'id',
      'organization_id',
      'name',
      'scopes',
      'last_used_at',
      'expires_at',
      'revoked_at',
      'created_by_user_id',
    ],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        key_hash: record.keyHash,
        key_prefix: record.keyPrefix,
        scopes: toSqliteJson(record.scopes),
        last_used_at: toSqliteDate(record.lastUsedAt),
        expires_at: toSqliteDate(record.expiresAt),
        revoked_at: toSqliteDate(record.revokedAt),
        created_by_user_id: record.createdByUserId ?? null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return apiKeyRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        keyHash: row.key_hash,
        keyPrefix: row.key_prefix,
        scopes: fromSqliteJson(row.scopes, []),
        lastUsedAt: fromSqliteDate(row.last_used_at),
        expiresAt: fromSqliteDate(row.expires_at),
        revokedAt: fromSqliteDate(row.revoked_at),
        createdByUserId: row.created_by_user_id ?? null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    ...base,
    async getAny(id) {
      const rows = await adapter.query<Record<string, unknown>>(
        sql`select * from ${sql.raw('api_keys')} where id = ${id} limit 1`,
      )
      return rows[0]
        ? apiKeyRecordSchema.parse({
            id: rows[0].id,
            organizationId: rows[0].organization_id,
            name: rows[0].name,
            keyHash: rows[0].key_hash,
            keyPrefix: rows[0].key_prefix,
            scopes: fromSqliteJson(rows[0].scopes, []),
            lastUsedAt: fromSqliteDate(rows[0].last_used_at),
            expiresAt: fromSqliteDate(rows[0].expires_at),
            revokedAt: fromSqliteDate(rows[0].revoked_at),
            createdByUserId: rows[0].created_by_user_id ?? null,
            createdAt: fromSqliteDate(rows[0].created_at),
            updatedAt: fromSqliteDate(rows[0].updated_at),
          })
        : null
    },
    async listAll(query) {
      const rows = await adapter.query<Record<string, unknown>>(sql`select * from ${sql.raw('api_keys')}`)
      return runArrayQuery(
        rows.map((row) =>
          apiKeyRecordSchema.parse({
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            keyHash: row.key_hash,
            keyPrefix: row.key_prefix,
            scopes: fromSqliteJson(row.scopes, []),
            lastUsedAt: fromSqliteDate(row.last_used_at),
            expiresAt: fromSqliteDate(row.expires_at),
            revokedAt: fromSqliteDate(row.revoked_at),
            createdByUserId: row.created_by_user_id ?? null,
            createdAt: fromSqliteDate(row.created_at),
            updatedAt: fromSqliteDate(row.updated_at),
          }),
        ),
        query,
        {
          searchableFields: ['name', 'key_prefix'],
          filterableFields: [
            'id',
            'organization_id',
            'name',
            'scopes',
            'last_used_at',
            'expires_at',
            'revoked_at',
            'created_by_user_id',
          ],
          defaultSort: [{ field: 'created_at', direction: 'desc' }],
        },
      )
    },
  }
}
