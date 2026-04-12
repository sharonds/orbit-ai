import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, OrbitDatabase, StorageAdapter } from '../../adapters/interface.js'
import { createTxBoundAdapter } from '../../adapters/tx-bound-adapter.js'
import { createTenantPostgresRepository, fromPostgresDate } from '../../repositories/postgres/shared.js'
import { createTenantSqliteRepository, fromSqliteDate, toSqliteDate } from '../../repositories/sqlite/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { tagRecordSchema, type TagRecord } from './validators.js'

export interface TagRepository {
  create(ctx: OrbitAuthContext, record: TagRecord): Promise<TagRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<TagRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<TagRecord>): Promise<TagRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TagRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TagRecord>>
  /** Batch fetch tags by IDs in a single query. Returns only found records (no nulls). */
  listByIds(ctx: OrbitAuthContext, ids: string[]): Promise<TagRecord[]>
  /** See `SequenceRepository.withDatabase` — same contract. */
  withDatabase(txDb: OrbitDatabase): TagRepository
}

const TAG_SEARCHABLE_FIELDS = ['name', 'color']
const TAG_FILTERABLE_FIELDS = ['id', 'organization_id', 'name', 'color']
const TAG_DEFAULT_SORT = [{ field: 'created_at', direction: 'desc' as const }]

export function createInMemoryTagRepository(seed: TagRecord[] = []): TagRepository {
  const rows = new Map(seed.map((record) => [record.id, tagRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): TagRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const repo: TagRepository = {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Tag organization mismatch')
      }

      const parsed = tagRecordSchema.parse(record)
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

      assertTenantPatchOrganizationInvariant(current.organizationId, patch)

      const next = tagRecordSchema.parse({
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
        searchableFields: TAG_SEARCHABLE_FIELDS,
        filterableFields: TAG_FILTERABLE_FIELDS,
        defaultSort: TAG_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: TAG_SEARCHABLE_FIELDS,
        filterableFields: TAG_FILTERABLE_FIELDS,
        defaultSort: TAG_DEFAULT_SORT,
      })
    },
    async listByIds(ctx, ids) {
      if (ids.length === 0) return []
      const idSet = new Set(ids)
      return scopedRows(ctx).filter((record) => idSet.has(record.id))
    },
    withDatabase() {
      return repo
    },
  }
  return repo
}

export function createSqliteTagRepository(adapter: StorageAdapter): TagRepository {
  const base = createTenantSqliteRepository<TagRecord>(adapter, {
    tableName: 'tags',
    columns: [
      'id',
      'organization_id',
      'name',
      'color',
      'created_at',
      'updated_at',
    ],
    searchableFields: TAG_SEARCHABLE_FIELDS,
    filterableFields: TAG_FILTERABLE_FIELDS,
    defaultSort: TAG_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        color: record.color ?? null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return tagRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        color: row.color ?? null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    async listByIds(ctx, ids) {
      if (ids.length === 0) return []
      const orgId = assertOrgContext(ctx)
      const idPlaceholders = sql.join(ids.map((id) => sql`${id}`), sql`, `)
      const statement = sql`select * from tags where organization_id = ${orgId} and id in (${idPlaceholders})`
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(statement)
        return rows.map((row) =>
          tagRecordSchema.parse({
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            color: row.color ?? null,
            createdAt: fromSqliteDate(row.created_at),
            updatedAt: fromSqliteDate(row.updated_at),
          }),
        )
      })
    },
    withDatabase(txDb) {
      return createSqliteTagRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}

export function createPostgresTagRepository(adapter: StorageAdapter): TagRepository {
  const base = createTenantPostgresRepository<TagRecord>(adapter, {
    tableName: 'tags',
    columns: [
      'id',
      'organization_id',
      'name',
      'color',
      'created_at',
      'updated_at',
    ],
    searchableFields: TAG_SEARCHABLE_FIELDS,
    filterableFields: TAG_FILTERABLE_FIELDS,
    defaultSort: TAG_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        color: record.color ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return tagRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        color: row.color ?? null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    async listByIds(ctx, ids) {
      if (ids.length === 0) return []
      const orgId = assertOrgContext(ctx)
      const idPlaceholders = sql.join(ids.map((id) => sql`${id}`), sql`, `)
      const statement = sql`select * from tags where organization_id = ${orgId} and id in (${idPlaceholders})`
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(statement)
        return rows.map((row) =>
          tagRecordSchema.parse({
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            color: row.color ?? null,
            createdAt: fromPostgresDate(row.created_at),
            updatedAt: fromPostgresDate(row.updated_at),
          }),
        )
      })
    },
    withDatabase(txDb) {
      return createPostgresTagRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}
