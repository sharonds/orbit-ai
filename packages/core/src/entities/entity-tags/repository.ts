import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantSqliteRepository, fromSqliteDate, toSqliteDate } from '../../repositories/sqlite/shared.js'
import { createTenantPostgresRepository, fromPostgresDate } from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { entityTagRecordSchema, type EntityTagRecord } from './validators.js'
import type { TagRepository } from '../tags/repository.js'

export interface EntityTagRepository {
  create(ctx: OrbitAuthContext, record: EntityTagRecord): Promise<EntityTagRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<EntityTagRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<EntityTagRecord>>
}

const SEARCHABLE_FIELDS = ['entity_type', 'entity_id']
const FILTERABLE_FIELDS = ['id', 'organization_id', 'tag_id', 'entity_type', 'entity_id']
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

async function assertTagExistsInTenant(
  tagLookup: Pick<TagRepository, 'get'>,
  ctx: OrbitAuthContext,
  tagId: string,
): Promise<void> {
  const tag = await tagLookup.get(ctx, tagId)
  if (!tag) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Tag ${tagId} not found in this organization`,
    })
  }
}

export function createInMemoryEntityTagRepository(
  seed: EntityTagRecord[] = [],
  deps: {
    tags?: Pick<TagRepository, 'get'>
  } = {},
): EntityTagRepository {
  const rows = new Map(seed.map((record) => [record.id, entityTagRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): EntityTagRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Entity tag organization mismatch')
      }

      if (!deps.tags) {
        throw new Error('Entity tag in-memory writes require a tag repository dependency')
      }
      await assertTagExistsInTenant(deps.tags, ctx, record.tagId)

      // Check unique constraint: (organizationId, tagId, entityType, entityId)
      for (const existing of rows.values()) {
        if (
          existing.organizationId === record.organizationId &&
          existing.tagId === record.tagId &&
          existing.entityType === record.entityType &&
          existing.entityId === record.entityId
        ) {
          throw createOrbitError({
            code: 'CONFLICT',
            message: `Entity tag already exists for tag ${record.tagId}, entity ${record.entityType}:${record.entityId}`,
          })
        }
      }

      const parsed = entityTagRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
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
        searchableFields: SEARCHABLE_FIELDS,
        filterableFields: FILTERABLE_FIELDS,
        defaultSort: DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteEntityTagRepository(adapter: StorageAdapter): EntityTagRepository {
  const base = createTenantSqliteRepository<EntityTagRecord>(adapter, {
    tableName: 'entity_tags',
    columns: [
      'id',
      'organization_id',
      'tag_id',
      'entity_type',
      'entity_id',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        tag_id: record.tagId,
        entity_type: record.entityType,
        entity_id: record.entityId,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return entityTagRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        tagId: row.tag_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Entity tag organization mismatch')
      }

      const tags = await adapter.withTenantContext(ctx, async (db) =>
        db.query<Record<string, unknown>>(
          sql`select id from tags where id = ${record.tagId} and organization_id = ${orgId} limit 1`,
        ),
      )

      if (!tags[0]) {
        throw createOrbitError({
          code: 'RELATION_NOT_FOUND',
          message: `Tag ${record.tagId} not found in this organization`,
        })
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    delete: base.delete.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresEntityTagRepository(adapter: StorageAdapter): EntityTagRepository {
  const base = createTenantPostgresRepository<EntityTagRecord>(adapter, {
    tableName: 'entity_tags',
    columns: [
      'id',
      'organization_id',
      'tag_id',
      'entity_type',
      'entity_id',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        tag_id: record.tagId,
        entity_type: record.entityType,
        entity_id: record.entityId,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return entityTagRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        tagId: row.tag_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Entity tag organization mismatch')
      }

      const tags = await adapter.withTenantContext(ctx, async (db) =>
        db.query<Record<string, unknown>>(
          sql`select id from tags where id = ${record.tagId} and organization_id = ${orgId} limit 1`,
        ),
      )

      if (!tags[0]) {
        throw createOrbitError({
          code: 'RELATION_NOT_FOUND',
          message: `Tag ${record.tagId} not found in this organization`,
        })
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    delete: base.delete.bind(base),
    list: base.list.bind(base),
  }
}
