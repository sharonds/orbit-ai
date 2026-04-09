import type { OrbitAuthContext, OrbitDatabase, StorageAdapter } from '../../adapters/interface.js'
import { createTxBoundAdapter } from '../../adapters/tx-bound-adapter.js'
import {
  createTenantSqliteRepository,
  fromSqliteBoolean,
  fromSqliteDate,
  toSqliteBoolean,
  toSqliteDate,
} from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresBoolean,
  fromPostgresDate,
} from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { pipelineRecordSchema, type PipelineRecord } from './validators.js'

export interface PipelineRepository {
  create(ctx: OrbitAuthContext, record: PipelineRecord): Promise<PipelineRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<PipelineRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<PipelineRecord>): Promise<PipelineRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<PipelineRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<PipelineRecord>>
  /** See `SequenceRepository.withDatabase` — same contract. */
  withDatabase(txDb: OrbitDatabase): PipelineRepository
}

export function createInMemoryPipelineRepository(seed: PipelineRecord[] = []): PipelineRepository {
  const rows = new Map(seed.map((record) => [record.id, pipelineRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): PipelineRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const repo: PipelineRepository = {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Pipeline organization mismatch')
      }

      const parsed = pipelineRecordSchema.parse(record)
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

      const next = pipelineRecordSchema.parse({
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
        searchableFields: ['name', 'description'],
        filterableFields: ['id', 'organization_id', 'name', 'description', 'is_default'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'description'],
        filterableFields: ['id', 'organization_id', 'name', 'description', 'is_default'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    withDatabase() {
      return repo
    },
  }
  return repo
}

export function createSqlitePipelineRepository(adapter: StorageAdapter): PipelineRepository {
  const base = createTenantSqliteRepository<PipelineRecord>(adapter, {
    tableName: 'pipelines',
    columns: ['id', 'organization_id', 'name', 'is_default', 'description', 'created_at', 'updated_at'],
    searchableFields: ['name', 'description'],
    filterableFields: ['id', 'organization_id', 'name', 'description', 'is_default'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        is_default: toSqliteBoolean(record.isDefault),
        description: record.description,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return pipelineRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        isDefault: fromSqliteBoolean(row.is_default),
        description: row.description ?? null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createSqlitePipelineRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}

export function createPostgresPipelineRepository(adapter: StorageAdapter): PipelineRepository {
  const base = createTenantPostgresRepository<PipelineRecord>(adapter, {
    tableName: 'pipelines',
    columns: ['id', 'organization_id', 'name', 'is_default', 'description', 'created_at', 'updated_at'],
    searchableFields: ['name', 'description'],
    filterableFields: ['id', 'organization_id', 'name', 'description', 'is_default'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        is_default: record.isDefault,
        description: record.description ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return pipelineRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        isDefault: fromPostgresBoolean(row.is_default),
        description: row.description ?? null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createPostgresPipelineRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}
