import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { contactRecordSchema, type ContactRecord } from './validators.js'

export interface ContactRepository {
  create(record: ContactRecord): Promise<ContactRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ContactRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<ContactRecord>): Promise<ContactRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ContactRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ContactRecord>>
}

export function createInMemoryContactRepository(seed: ContactRecord[] = []): ContactRepository {
  const rows = new Map(seed.map((record) => [record.id, contactRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): ContactRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(record) {
      const parsed = contactRecordSchema.parse(record)
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

      const next = contactRecordSchema.parse({
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
        searchableFields: ['name', 'email', 'phone', 'title', 'source_channel'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'email', 'phone', 'title', 'source_channel'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}
