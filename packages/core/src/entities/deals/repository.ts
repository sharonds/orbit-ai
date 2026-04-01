import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { dealRecordSchema, type DealRecord } from './validators.js'

export interface DealRepository {
  create(ctx: OrbitAuthContext, record: DealRecord): Promise<DealRecord>
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
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Deal organization mismatch')
      }

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

export function createSqliteDealRepository(adapter: StorageAdapter): DealRepository {
  return createTenantSqliteRepository<DealRecord>(adapter, {
    tableName: 'deals',
    columns: [
      'id',
      'organization_id',
      'title',
      'value',
      'currency',
      'stage_id',
      'pipeline_id',
      'probability',
      'expected_close_date',
      'contact_id',
      'company_id',
      'assigned_to_user_id',
      'status',
      'won_at',
      'lost_at',
      'lost_reason',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['title', 'currency', 'status', 'lost_reason'],
    defaultSort: [{ field: 'updated_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        title: record.title,
        value: record.value,
        currency: record.currency,
        stage_id: record.stageId ?? null,
        pipeline_id: record.pipelineId ?? null,
        probability: record.probability,
        expected_close_date: toSqliteDate(record.expectedCloseDate),
        contact_id: record.contactId ?? null,
        company_id: record.companyId ?? null,
        assigned_to_user_id: record.assignedToUserId ?? null,
        status: record.status,
        won_at: toSqliteDate(record.wonAt),
        lost_at: toSqliteDate(record.lostAt),
        lost_reason: record.lostReason,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return dealRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        title: row.title,
        value: row.value ?? null,
        currency: row.currency,
        stageId: row.stage_id ?? null,
        pipelineId: row.pipeline_id ?? null,
        probability: row.probability,
        expectedCloseDate: fromSqliteDate(row.expected_close_date),
        contactId: row.contact_id ?? null,
        companyId: row.company_id ?? null,
        assignedToUserId: row.assigned_to_user_id ?? null,
        status: row.status,
        wonAt: fromSqliteDate(row.won_at),
        lostAt: fromSqliteDate(row.lost_at),
        lostReason: row.lost_reason ?? null,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}
