import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteBoolean,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteBoolean,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { contactRecordSchema, type ContactRecord } from './validators.js'

export interface ContactRepository {
  create(ctx: OrbitAuthContext, record: ContactRecord): Promise<ContactRecord>
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
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Contact organization mismatch')
      }

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
        filterableFields: [
          'id',
          'organization_id',
          'name',
          'email',
          'phone',
          'title',
          'source_channel',
          'status',
          'assigned_to_user_id',
          'company_id',
          'lead_score',
          'is_hot',
          'last_contacted_at',
        ],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['name', 'email', 'phone', 'title', 'source_channel'],
        filterableFields: [
          'id',
          'organization_id',
          'name',
          'email',
          'phone',
          'title',
          'source_channel',
          'status',
          'assigned_to_user_id',
          'company_id',
          'lead_score',
          'is_hot',
          'last_contacted_at',
        ],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteContactRepository(adapter: StorageAdapter): ContactRepository {
  return createTenantSqliteRepository<ContactRecord>(adapter, {
    tableName: 'contacts',
    columns: [
      'id',
      'organization_id',
      'name',
      'email',
      'phone',
      'title',
      'source_channel',
      'status',
      'assigned_to_user_id',
      'company_id',
      'lead_score',
      'is_hot',
      'last_contacted_at',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['name', 'email', 'phone', 'title', 'source_channel'],
    filterableFields: [
      'id',
      'organization_id',
      'name',
      'email',
      'phone',
      'title',
      'source_channel',
      'status',
      'assigned_to_user_id',
      'company_id',
      'lead_score',
      'is_hot',
      'last_contacted_at',
    ],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        email: record.email ?? null,
        phone: record.phone ?? null,
        title: record.title,
        source_channel: record.sourceChannel,
        status: record.status,
        assigned_to_user_id: record.assignedToUserId ?? null,
        company_id: record.companyId ?? null,
        lead_score: record.leadScore,
        is_hot: toSqliteBoolean(record.isHot),
        last_contacted_at: toSqliteDate(record.lastContactedAt),
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return contactRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
        title: row.title ?? null,
        sourceChannel: row.source_channel ?? null,
        status: row.status,
        assignedToUserId: row.assigned_to_user_id ?? null,
        companyId: row.company_id ?? null,
        leadScore: row.lead_score,
        isHot: fromSqliteBoolean(row.is_hot),
        lastContactedAt: fromSqliteDate(row.last_contacted_at),
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}
