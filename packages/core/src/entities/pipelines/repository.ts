import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { pipelineRecordSchema, type PipelineRecord } from './validators.js'

export interface PipelineRepository {
  create(record: PipelineRecord): Promise<PipelineRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<PipelineRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<PipelineRecord>): Promise<PipelineRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<PipelineRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<PipelineRecord>>
}

export function createInMemoryPipelineRepository(seed: PipelineRecord[] = []): PipelineRepository {
  const rows = new Map(seed.map((record) => [record.id, pipelineRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): PipelineRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(record) {
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
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'description'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}
