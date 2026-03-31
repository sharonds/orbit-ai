import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { apiKeyRecordSchema, type ApiKeyRecord } from './validators.js'

export interface ApiKeyRepository {
  create(record: ApiKeyRecord): Promise<ApiKeyRecord>
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
    async create(record) {
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
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'key_prefix'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async listAll(query) {
      return runArrayQuery(allRows(), query, {
        searchableFields: ['name', 'key_prefix'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}
