import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { paymentRecordSchema, type PaymentRecord } from './validators.js'

export interface PaymentRepository {
  create(ctx: OrbitAuthContext, record: PaymentRecord): Promise<PaymentRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<PaymentRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<PaymentRecord>): Promise<PaymentRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<PaymentRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<PaymentRecord>>
}

export function createInMemoryPaymentRepository(seed: PaymentRecord[] = []): PaymentRepository {
  const rows = new Map(seed.map((record) => [record.id, paymentRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): PaymentRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const queryOptions = {
    searchableFields: ['status', 'method', 'externalId'],
    filterableFields: [
      'id',
      'organization_id',
      'amount',
      'currency',
      'status',
      'method',
      'deal_id',
      'contact_id',
      'external_id',
      'paid_at',
    ],
    defaultSort: [
      { field: 'paid_at', direction: 'desc' as const },
      { field: 'created_at', direction: 'desc' as const },
    ],
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Payment organization mismatch')
      }

      const parsed = paymentRecordSchema.parse(record)
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

      const next = paymentRecordSchema.parse({
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
      return runArrayQuery(scopedRows(ctx), query, queryOptions)
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, queryOptions)
    },
  }
}

export function createSqlitePaymentRepository(adapter: StorageAdapter): PaymentRepository {
  return createTenantSqliteRepository<PaymentRecord>(adapter, {
    tableName: 'payments',
    columns: [
      'id',
      'organization_id',
      'amount',
      'currency',
      'status',
      'method',
      'deal_id',
      'contact_id',
      'external_id',
      'paid_at',
      'metadata',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['status', 'method', 'external_id'],
    filterableFields: [
      'id',
      'organization_id',
      'amount',
      'currency',
      'status',
      'method',
      'deal_id',
      'contact_id',
      'external_id',
      'paid_at',
    ],
    defaultSort: [
      { field: 'paid_at', direction: 'desc' },
      { field: 'created_at', direction: 'desc' },
    ],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        amount: record.amount,
        currency: record.currency,
        status: record.status,
        method: record.method ?? null,
        deal_id: record.dealId ?? null,
        contact_id: record.contactId ?? null,
        external_id: record.externalId ?? null,
        paid_at: toSqliteDate(record.paidAt),
        metadata: toSqliteJson(record.metadata),
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return paymentRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        method: row.method ?? null,
        dealId: row.deal_id ?? null,
        contactId: row.contact_id ?? null,
        externalId: row.external_id ?? null,
        paidAt: fromSqliteDate(row.paid_at),
        metadata: fromSqliteJson(row.metadata, {}),
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresPaymentRepository(adapter: StorageAdapter): PaymentRepository {
  return createTenantPostgresRepository<PaymentRecord>(adapter, {
    tableName: 'payments',
    columns: [
      'id',
      'organization_id',
      'amount',
      'currency',
      'status',
      'method',
      'deal_id',
      'contact_id',
      'external_id',
      'paid_at',
      'metadata',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['status', 'method', 'external_id'],
    filterableFields: [
      'id',
      'organization_id',
      'amount',
      'currency',
      'status',
      'method',
      'deal_id',
      'contact_id',
      'external_id',
      'paid_at',
    ],
    defaultSort: [
      { field: 'paid_at', direction: 'desc' },
      { field: 'created_at', direction: 'desc' },
    ],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        amount: record.amount,
        currency: record.currency,
        status: record.status,
        method: record.method ?? null,
        deal_id: record.dealId ?? null,
        contact_id: record.contactId ?? null,
        external_id: record.externalId ?? null,
        paid_at: record.paidAt,
        metadata: record.metadata,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return paymentRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        method: row.method ?? null,
        dealId: row.deal_id ?? null,
        contactId: row.contact_id ?? null,
        externalId: row.external_id ?? null,
        paidAt: fromPostgresDate(row.paid_at),
        metadata: fromPostgresJson(row.metadata, {}),
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
