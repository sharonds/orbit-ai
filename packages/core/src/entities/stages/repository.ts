import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { stageRecordSchema, type StageRecord } from './validators.js'

export interface StageRepository {
  create(record: StageRecord): Promise<StageRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<StageRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<StageRecord>): Promise<StageRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<StageRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<StageRecord>>
}

export function createInMemoryStageRepository(seed: StageRecord[] = []): StageRepository {
  const rows = new Map(seed.map((record) => [record.id, stageRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): StageRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(record) {
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
        defaultSort: [{ field: 'stage_order', direction: 'asc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'color'],
        defaultSort: [{ field: 'stage_order', direction: 'asc' }],
      })
    },
  }
}
