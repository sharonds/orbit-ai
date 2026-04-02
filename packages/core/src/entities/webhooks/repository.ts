import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { webhookRecordSchema, type WebhookRecord } from './validators.js'

export interface WebhookRepository {
  create(ctx: OrbitAuthContext, record: WebhookRecord): Promise<WebhookRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<WebhookRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<WebhookRecord>): Promise<WebhookRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<WebhookRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<WebhookRecord>>
}

const WEBHOOK_SEARCHABLE_FIELDS = ['url', 'description', 'status']
const WEBHOOK_FILTERABLE_FIELDS = ['id', 'organization_id', 'url', 'status']
const WEBHOOK_DEFAULT_SORT = [{ field: 'created_at', direction: 'desc' as const }]

export function createInMemoryWebhookRepository(seed: WebhookRecord[] = []): WebhookRepository {
  const rows = new Map(seed.map((record) => [record.id, webhookRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): WebhookRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Webhook organization mismatch')
      }

      const parsed = webhookRecordSchema.parse(record)
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

      assertTenantPatchOrganizationInvariant(current.organizationId, patch)

      const next = webhookRecordSchema.parse({
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
        searchableFields: WEBHOOK_SEARCHABLE_FIELDS,
        filterableFields: WEBHOOK_FILTERABLE_FIELDS,
        defaultSort: WEBHOOK_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: WEBHOOK_SEARCHABLE_FIELDS,
        filterableFields: WEBHOOK_FILTERABLE_FIELDS,
        defaultSort: WEBHOOK_DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteWebhookRepository(adapter: StorageAdapter): WebhookRepository {
  return createTenantSqliteRepository<WebhookRecord>(adapter, {
    tableName: 'webhooks',
    columns: [
      'id',
      'organization_id',
      'url',
      'description',
      'events',
      'secret_encrypted',
      'secret_last_four',
      'secret_created_at',
      'status',
      'last_triggered_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: WEBHOOK_SEARCHABLE_FIELDS,
    filterableFields: WEBHOOK_FILTERABLE_FIELDS,
    defaultSort: WEBHOOK_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        url: record.url,
        description: record.description ?? null,
        events: toSqliteJson(record.events),
        secret_encrypted: record.secretEncrypted,
        secret_last_four: record.secretLastFour,
        secret_created_at: toSqliteDate(record.secretCreatedAt),
        status: record.status,
        last_triggered_at: record.lastTriggeredAt ? toSqliteDate(record.lastTriggeredAt) : null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return webhookRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        url: row.url,
        description: row.description ?? null,
        events: fromSqliteJson(row.events, []),
        secretEncrypted: row.secret_encrypted,
        secretLastFour: row.secret_last_four,
        secretCreatedAt: fromSqliteDate(row.secret_created_at),
        status: row.status,
        lastTriggeredAt: row.last_triggered_at ? fromSqliteDate(row.last_triggered_at) : null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresWebhookRepository(adapter: StorageAdapter): WebhookRepository {
  return createTenantPostgresRepository<WebhookRecord>(adapter, {
    tableName: 'webhooks',
    columns: [
      'id',
      'organization_id',
      'url',
      'description',
      'events',
      'secret_encrypted',
      'secret_last_four',
      'secret_created_at',
      'status',
      'last_triggered_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: WEBHOOK_SEARCHABLE_FIELDS,
    filterableFields: WEBHOOK_FILTERABLE_FIELDS,
    defaultSort: WEBHOOK_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        url: record.url,
        description: record.description ?? null,
        events: JSON.stringify(record.events),
        secret_encrypted: record.secretEncrypted,
        secret_last_four: record.secretLastFour,
        secret_created_at: record.secretCreatedAt,
        status: record.status,
        last_triggered_at: record.lastTriggeredAt ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return webhookRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        url: row.url,
        description: row.description ?? null,
        events: fromPostgresJson(row.events, []),
        secretEncrypted: row.secret_encrypted,
        secretLastFour: row.secret_last_four,
        secretCreatedAt: fromPostgresDate(row.secret_created_at),
        status: row.status,
        lastTriggeredAt: row.last_triggered_at ? fromPostgresDate(row.last_triggered_at) : null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
