import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { userRecordSchema, type UserRecord } from './validators.js'

export interface UserRepository {
  create(record: UserRecord): Promise<UserRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<UserRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<UserRecord>): Promise<UserRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<UserRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<UserRecord>>
}

export function createInMemoryUserRepository(seed: UserRecord[] = []): UserRepository {
  const rows = new Map(seed.map((record) => [record.id, userRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): UserRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(record) {
      const parsed = userRecordSchema.parse(record)
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

      const next = userRecordSchema.parse({
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
        searchableFields: ['email', 'name', 'role', 'external_auth_id'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['email', 'name', 'role', 'external_auth_id'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}
