import { sql } from 'drizzle-orm'

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
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { webhookDeliveryRecordSchema, type WebhookDeliveryRecord } from './validators.js'
import type { WebhookRepository } from '../webhooks/repository.js'

export interface WebhookDeliveryRepository {
  create(ctx: OrbitAuthContext, record: WebhookDeliveryRecord): Promise<WebhookDeliveryRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<WebhookDeliveryRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<WebhookDeliveryRecord>>
}

const SEARCHABLE_FIELDS = ['event_type', 'status', 'last_error']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'webhook_id',
  'event_id',
  'event_type',
  'status',
  'response_status',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

async function assertWebhookExistsInTenant(
  webhooks: Pick<WebhookRepository, 'get'>,
  ctx: OrbitAuthContext,
  webhookId: string,
): Promise<void> {
  const webhook = await webhooks.get(ctx, webhookId)
  if (!webhook) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Webhook ${webhookId} not found in this organization`,
    })
  }
}

export function createInMemoryWebhookDeliveryRepository(
  seed: WebhookDeliveryRecord[] = [],
  deps: {
    webhooks?: Pick<WebhookRepository, 'get'>
  } = {},
): WebhookDeliveryRepository {
  const rows = new Map(seed.map((record) => [record.id, webhookDeliveryRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): WebhookDeliveryRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Webhook delivery organization mismatch')
      }

      if (!deps.webhooks) {
        throw new Error('Webhook delivery in-memory writes require a webhook repository dependency')
      }
      await assertWebhookExistsInTenant(deps.webhooks, ctx, record.webhookId)

      // Check unique constraint: (webhookId, eventId)
      for (const existing of rows.values()) {
        if (existing.webhookId === record.webhookId && existing.eventId === record.eventId) {
          throw createOrbitError({
            code: 'CONFLICT',
            message: `Webhook delivery already exists for webhook ${record.webhookId}, event ${record.eventId}`,
          })
        }
      }

      const parsed = webhookDeliveryRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEARCHABLE_FIELDS,
        filterableFields: FILTERABLE_FIELDS,
        defaultSort: DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteWebhookDeliveryRepository(adapter: StorageAdapter): WebhookDeliveryRepository {
  const base = createTenantSqliteRepository<WebhookDeliveryRecord>(adapter, {
    tableName: 'webhook_deliveries',
    columns: [
      'id',
      'organization_id',
      'webhook_id',
      'event_id',
      'event_type',
      'payload',
      'signature',
      'idempotency_key',
      'status',
      'response_status',
      'response_body',
      'attempt_count',
      'next_attempt_at',
      'delivered_at',
      'last_error',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        webhook_id: record.webhookId,
        event_id: record.eventId,
        event_type: record.eventType,
        payload: toSqliteJson(record.payload),
        signature: record.signature,
        idempotency_key: record.idempotencyKey,
        status: record.status,
        response_status: record.responseStatus ?? null,
        response_body: record.responseBody ?? null,
        attempt_count: record.attemptCount,
        next_attempt_at: toSqliteDate(record.nextAttemptAt),
        delivered_at: toSqliteDate(record.deliveredAt),
        last_error: record.lastError ?? null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return webhookDeliveryRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        webhookId: row.webhook_id,
        eventId: row.event_id,
        eventType: row.event_type,
        payload: fromSqliteJson(row.payload, {}),
        signature: row.signature,
        idempotencyKey: row.idempotency_key,
        status: row.status,
        responseStatus: row.response_status ?? null,
        responseBody: row.response_body ?? null,
        attemptCount: row.attempt_count,
        nextAttemptAt: fromSqliteDate(row.next_attempt_at),
        deliveredAt: fromSqliteDate(row.delivered_at),
        lastError: row.last_error ?? null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Webhook delivery organization mismatch')
      }

      const webhooks = await adapter.withTenantContext(ctx, async (db) =>
        db.query<Record<string, unknown>>(
          sql`select id from webhooks where id = ${record.webhookId} and organization_id = ${orgId} limit 1`,
        ),
      )

      if (!webhooks[0]) {
        throw createOrbitError({
          code: 'RELATION_NOT_FOUND',
          message: `Webhook ${record.webhookId} not found in this organization`,
        })
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresWebhookDeliveryRepository(adapter: StorageAdapter): WebhookDeliveryRepository {
  const base = createTenantPostgresRepository<WebhookDeliveryRecord>(adapter, {
    tableName: 'webhook_deliveries',
    columns: [
      'id',
      'organization_id',
      'webhook_id',
      'event_id',
      'event_type',
      'payload',
      'signature',
      'idempotency_key',
      'status',
      'response_status',
      'response_body',
      'attempt_count',
      'next_attempt_at',
      'delivered_at',
      'last_error',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        webhook_id: record.webhookId,
        event_id: record.eventId,
        event_type: record.eventType,
        payload: record.payload,
        signature: record.signature,
        idempotency_key: record.idempotencyKey,
        status: record.status,
        response_status: record.responseStatus ?? null,
        response_body: record.responseBody ?? null,
        attempt_count: record.attemptCount,
        next_attempt_at: record.nextAttemptAt,
        delivered_at: record.deliveredAt,
        last_error: record.lastError ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return webhookDeliveryRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        webhookId: row.webhook_id,
        eventId: row.event_id,
        eventType: row.event_type,
        payload: fromPostgresJson(row.payload, {}),
        signature: row.signature,
        idempotencyKey: row.idempotency_key,
        status: row.status,
        responseStatus: row.response_status ?? null,
        responseBody: row.response_body ?? null,
        attemptCount: row.attempt_count,
        nextAttemptAt: fromPostgresDate(row.next_attempt_at),
        deliveredAt: fromPostgresDate(row.delivered_at),
        lastError: row.last_error ?? null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Webhook delivery organization mismatch')
      }

      const webhooks = await adapter.withTenantContext(ctx, async (db) =>
        db.query<Record<string, unknown>>(
          sql`select id from webhooks where id = ${record.webhookId} and organization_id = ${orgId} limit 1`,
        ),
      )

      if (!webhooks[0]) {
        throw createOrbitError({
          code: 'RELATION_NOT_FOUND',
          message: `Webhook ${record.webhookId} not found in this organization`,
        })
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
