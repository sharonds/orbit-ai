import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantSqliteRepository, fromSqliteDate, fromSqliteJson, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { companyRecordSchema, type CompanyRecord } from './validators.js'

export interface CompanyRepository {
  create(ctx: OrbitAuthContext, record: CompanyRecord): Promise<CompanyRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<CompanyRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<CompanyRecord>): Promise<CompanyRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<CompanyRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<CompanyRecord>>
}

export function createInMemoryCompanyRepository(seed: CompanyRecord[] = []): CompanyRepository {
  const rows = new Map(seed.map((record) => [record.id, companyRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): CompanyRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Company organization mismatch')
      }

      const parsed = companyRecordSchema.parse(record)
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

      const next = companyRecordSchema.parse({
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
        searchableFields: ['name', 'domain', 'industry', 'website', 'notes'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'domain', 'industry', 'website', 'notes'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteCompanyRepository(adapter: StorageAdapter): CompanyRepository {
  return createTenantSqliteRepository<CompanyRecord>(adapter, {
    tableName: 'companies',
    columns: [
      'id',
      'organization_id',
      'name',
      'domain',
      'industry',
      'size',
      'website',
      'notes',
      'assigned_to_user_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['name', 'domain', 'industry', 'website', 'notes'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        domain: record.domain,
        industry: record.industry,
        size: record.size,
        website: record.website ?? null,
        notes: record.notes,
        assigned_to_user_id: record.assignedToUserId ?? null,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return companyRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        domain: row.domain ?? null,
        industry: row.industry ?? null,
        size: row.size ?? null,
        website: row.website ?? null,
        notes: row.notes ?? null,
        assignedToUserId: row.assigned_to_user_id ?? null,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}
