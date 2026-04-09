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
import { stageRecordSchema, type StageRecord } from './validators.js'

export interface StageRepository {
  create(ctx: OrbitAuthContext, record: StageRecord): Promise<StageRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<StageRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<StageRecord>): Promise<StageRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<StageRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<StageRecord>>
  /** See `SequenceRepository.withDatabase` — same contract. */
  withDatabase(txDb: OrbitDatabase): StageRepository
}

export function createInMemoryStageRepository(seed: StageRecord[] = []): StageRepository {
  const rows = new Map(seed.map((record) => [record.id, stageRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): StageRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const repo: StageRepository = {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Stage organization mismatch')
      }

      const parsed = stageRecordSchema.parse(record)
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

      const next = stageRecordSchema.parse({
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
        searchableFields: ['name', 'color'],
        filterableFields: [
          'id',
          'organization_id',
          'pipeline_id',
          'name',
          'stage_order',
          'probability',
          'color',
          'is_won',
          'is_lost',
        ],
        defaultSort: [{ field: 'stage_order', direction: 'asc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'color'],
        filterableFields: [
          'id',
          'organization_id',
          'pipeline_id',
          'name',
          'stage_order',
          'probability',
          'color',
          'is_won',
          'is_lost',
        ],
        defaultSort: [{ field: 'stage_order', direction: 'asc' }],
      })
    },
    withDatabase() {
      return repo
    },
  }
  return repo
}

export function createSqliteStageRepository(adapter: StorageAdapter): StageRepository {
  const base = createTenantSqliteRepository<StageRecord>(adapter, {
    tableName: 'stages',
    columns: [
      'id',
      'organization_id',
      'pipeline_id',
      'name',
      'stage_order',
      'probability',
      'color',
      'is_won',
      'is_lost',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['name', 'color'],
    filterableFields: [
      'id',
      'organization_id',
      'pipeline_id',
      'name',
      'stage_order',
      'probability',
      'color',
      'is_won',
      'is_lost',
    ],
    defaultSort: [{ field: 'stage_order', direction: 'asc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        pipeline_id: record.pipelineId,
        name: record.name,
        stage_order: record.stageOrder,
        probability: record.probability,
        color: record.color,
        is_won: toSqliteBoolean(record.isWon),
        is_lost: toSqliteBoolean(record.isLost),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return stageRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        pipelineId: row.pipeline_id,
        name: row.name,
        stageOrder: row.stage_order,
        probability: row.probability,
        color: row.color ?? null,
        isWon: fromSqliteBoolean(row.is_won),
        isLost: fromSqliteBoolean(row.is_lost),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createSqliteStageRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}

export function createPostgresStageRepository(adapter: StorageAdapter): StageRepository {
  const base = createTenantPostgresRepository<StageRecord>(adapter, {
    tableName: 'stages',
    columns: [
      'id',
      'organization_id',
      'pipeline_id',
      'name',
      'stage_order',
      'probability',
      'color',
      'is_won',
      'is_lost',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['name', 'color'],
    filterableFields: [
      'id',
      'organization_id',
      'pipeline_id',
      'name',
      'stage_order',
      'probability',
      'color',
      'is_won',
      'is_lost',
    ],
    defaultSort: [{ field: 'stage_order', direction: 'asc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        pipeline_id: record.pipelineId,
        name: record.name,
        stage_order: record.stageOrder,
        probability: record.probability,
        color: record.color ?? null,
        is_won: record.isWon,
        is_lost: record.isLost,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return stageRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        pipelineId: row.pipeline_id,
        name: row.name,
        stageOrder: row.stage_order,
        probability: row.probability,
        color: row.color ?? null,
        isWon: fromPostgresBoolean(row.is_won),
        isLost: fromPostgresBoolean(row.is_lost),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createPostgresStageRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}
