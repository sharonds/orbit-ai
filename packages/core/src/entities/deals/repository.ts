import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { dealRecordSchema, type DealRecord } from './validators.js'

export interface DealRepository {
  create(record: DealRecord): Promise<DealRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<DealRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<DealRecord>): Promise<DealRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<DealRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<DealRecord>>
}

export function createInMemoryDealRepository(seed: DealRecord[] = []): DealRepository {
  const rows = new Map(seed.map((record) => [record.id, dealRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): DealRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(record) {
      const parsed = dealRecordSchema.parse(record)
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

      const next = dealRecordSchema.parse({
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
        searchableFields: ['title', 'currency', 'status', 'lost_reason'],
        defaultSort: [{ field: 'updated_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['title', 'currency', 'status', 'lost_reason'],
        defaultSort: [{ field: 'updated_at', direction: 'desc' }],
      })
    },
  }
}
