import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantSqliteRepository, fromSqliteDate, fromSqliteJson, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { noteRecordSchema, type NoteRecord } from './validators.js'

export interface NoteRepository {
  create(ctx: OrbitAuthContext, record: NoteRecord): Promise<NoteRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<NoteRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<NoteRecord>): Promise<NoteRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<NoteRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<NoteRecord>>
}

export function createInMemoryNoteRepository(seed: NoteRecord[] = []): NoteRepository {
  const rows = new Map(seed.map((record) => [record.id, noteRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): NoteRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Note organization mismatch')
      }

      const parsed = noteRecordSchema.parse(record)
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

      const next = noteRecordSchema.parse({
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
        searchableFields: ['content'],
        filterableFields: ['id', 'organization_id', 'contact_id', 'deal_id', 'company_id', 'created_by_user_id'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['content'],
        filterableFields: ['id', 'organization_id', 'contact_id', 'deal_id', 'company_id', 'created_by_user_id'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteNoteRepository(adapter: StorageAdapter): NoteRepository {
  return createTenantSqliteRepository<NoteRecord>(adapter, {
    tableName: 'notes',
    columns: [
      'id',
      'organization_id',
      'content',
      'contact_id',
      'deal_id',
      'company_id',
      'created_by_user_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['content'],
    filterableFields: ['id', 'organization_id', 'contact_id', 'deal_id', 'company_id', 'created_by_user_id'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        content: record.content,
        contact_id: record.contactId ?? null,
        deal_id: record.dealId ?? null,
        company_id: record.companyId ?? null,
        created_by_user_id: record.createdByUserId ?? null,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return noteRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        content: row.content,
        contactId: row.contact_id ?? null,
        dealId: row.deal_id ?? null,
        companyId: row.company_id ?? null,
        createdByUserId: row.created_by_user_id ?? null,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresNoteRepository(adapter: StorageAdapter): NoteRepository {
  return createTenantPostgresRepository<NoteRecord>(adapter, {
    tableName: 'notes',
    columns: [
      'id',
      'organization_id',
      'content',
      'contact_id',
      'deal_id',
      'company_id',
      'created_by_user_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['content'],
    filterableFields: ['id', 'organization_id', 'contact_id', 'deal_id', 'company_id', 'created_by_user_id'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        content: record.content,
        contact_id: record.contactId ?? null,
        deal_id: record.dealId ?? null,
        company_id: record.companyId ?? null,
        created_by_user_id: record.createdByUserId ?? null,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return noteRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        content: row.content,
        contactId: row.contact_id ?? null,
        dealId: row.deal_id ?? null,
        companyId: row.company_id ?? null,
        createdByUserId: row.created_by_user_id ?? null,
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
