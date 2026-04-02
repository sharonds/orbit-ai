import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantSqliteRepository, fromSqliteDate, fromSqliteJson, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { activityRecordSchema, type ActivityRecord } from './validators.js'

export interface ActivityRepository {
  create(ctx: OrbitAuthContext, record: ActivityRecord): Promise<ActivityRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ActivityRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<ActivityRecord>): Promise<ActivityRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ActivityRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ActivityRecord>>
}

export function createInMemoryActivityRepository(seed: ActivityRecord[] = []): ActivityRepository {
  const rows = new Map(seed.map((record) => [record.id, activityRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): ActivityRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Activity organization mismatch')
      }

      const parsed = activityRecordSchema.parse(record)
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

      const next = activityRecordSchema.parse({
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
        searchableFields: ['type', 'subject', 'body', 'direction', 'outcome'],
        filterableFields: [
          'id',
          'organization_id',
          'type',
          'subject',
          'direction',
          'contact_id',
          'deal_id',
          'company_id',
          'duration_minutes',
          'outcome',
          'occurred_at',
          'logged_by_user_id',
        ],
        defaultSort: [{ field: 'occurred_at', direction: 'desc' }],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['type', 'subject', 'body', 'direction', 'outcome'],
        filterableFields: [
          'id',
          'organization_id',
          'type',
          'subject',
          'direction',
          'contact_id',
          'deal_id',
          'company_id',
          'duration_minutes',
          'outcome',
          'occurred_at',
          'logged_by_user_id',
        ],
        defaultSort: [{ field: 'occurred_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteActivityRepository(adapter: StorageAdapter): ActivityRepository {
  return createTenantSqliteRepository<ActivityRecord>(adapter, {
    tableName: 'activities',
    columns: [
      'id',
      'organization_id',
      'type',
      'subject',
      'body',
      'direction',
      'contact_id',
      'deal_id',
      'company_id',
      'duration_minutes',
      'outcome',
      'occurred_at',
      'logged_by_user_id',
      'metadata',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['type', 'subject', 'body', 'direction', 'outcome'],
    filterableFields: [
      'id',
      'organization_id',
      'type',
      'subject',
      'direction',
      'contact_id',
      'deal_id',
      'company_id',
      'duration_minutes',
      'outcome',
      'occurred_at',
      'logged_by_user_id',
    ],
    defaultSort: [{ field: 'occurred_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        type: record.type,
        subject: record.subject ?? null,
        body: record.body ?? null,
        direction: record.direction,
        contact_id: record.contactId ?? null,
        deal_id: record.dealId ?? null,
        company_id: record.companyId ?? null,
        duration_minutes: record.durationMinutes ?? null,
        outcome: record.outcome ?? null,
        occurred_at: toSqliteDate(record.occurredAt),
        logged_by_user_id: record.loggedByUserId ?? null,
        metadata: toSqliteJson(record.metadata),
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return activityRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        type: row.type,
        subject: row.subject ?? null,
        body: row.body ?? null,
        direction: row.direction,
        contactId: row.contact_id ?? null,
        dealId: row.deal_id ?? null,
        companyId: row.company_id ?? null,
        durationMinutes: row.duration_minutes ?? null,
        outcome: row.outcome ?? null,
        occurredAt: fromSqliteDate(row.occurred_at),
        loggedByUserId: row.logged_by_user_id ?? null,
        metadata: fromSqliteJson(row.metadata, {}),
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresActivityRepository(adapter: StorageAdapter): ActivityRepository {
  return createTenantPostgresRepository<ActivityRecord>(adapter, {
    tableName: 'activities',
    columns: [
      'id',
      'organization_id',
      'type',
      'subject',
      'body',
      'direction',
      'contact_id',
      'deal_id',
      'company_id',
      'duration_minutes',
      'outcome',
      'occurred_at',
      'logged_by_user_id',
      'metadata',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['type', 'subject', 'body', 'direction', 'outcome'],
    filterableFields: [
      'id',
      'organization_id',
      'type',
      'subject',
      'direction',
      'contact_id',
      'deal_id',
      'company_id',
      'duration_minutes',
      'outcome',
      'occurred_at',
      'logged_by_user_id',
    ],
    defaultSort: [{ field: 'occurred_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        type: record.type,
        subject: record.subject ?? null,
        body: record.body ?? null,
        direction: record.direction,
        contact_id: record.contactId ?? null,
        deal_id: record.dealId ?? null,
        company_id: record.companyId ?? null,
        duration_minutes: record.durationMinutes ?? null,
        outcome: record.outcome ?? null,
        occurred_at: record.occurredAt,
        logged_by_user_id: record.loggedByUserId ?? null,
        metadata: record.metadata,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return activityRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        type: row.type,
        subject: row.subject ?? null,
        body: row.body ?? null,
        direction: row.direction,
        contactId: row.contact_id ?? null,
        dealId: row.deal_id ?? null,
        companyId: row.company_id ?? null,
        durationMinutes: row.duration_minutes ?? null,
        outcome: row.outcome ?? null,
        occurredAt: fromPostgresDate(row.occurred_at),
        loggedByUserId: row.logged_by_user_id ?? null,
        metadata: fromPostgresJson(row.metadata, {}),
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
