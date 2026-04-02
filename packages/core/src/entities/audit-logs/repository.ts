import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresDate,
  fromPostgresJson,
} from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { UserRepository } from '../users/repository.js'
import type { ApiKeyRepository } from '../api-keys/repository.js'
import { auditLogRecordSchema, type AuditLogRecord } from './validators.js'

export interface AuditLogRepository {
  create(ctx: OrbitAuthContext, record: AuditLogRecord): Promise<AuditLogRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<AuditLogRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<AuditLogRecord>>
}

const SEARCHABLE_FIELDS = ['entity_type', 'entity_id', 'action']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'actor_user_id',
  'actor_api_key_id',
  'entity_type',
  'entity_id',
  'action',
  'request_id',
]
const DEFAULT_SORT = [{ field: 'occurred_at', direction: 'desc' as const }]

async function assertActorUserInTenant(
  users: Pick<UserRepository, 'get'>,
  ctx: OrbitAuthContext,
  userId: string,
): Promise<void> {
  const user = await users.get(ctx, userId)
  if (!user) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Actor user ${userId} not found in this organization`,
    })
  }
}

async function assertActorApiKeyInTenant(
  apiKeys: Pick<ApiKeyRepository, 'get'>,
  ctx: OrbitAuthContext,
  apiKeyId: string,
): Promise<void> {
  const key = await apiKeys.get(ctx, apiKeyId)
  if (!key) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Actor API key ${apiKeyId} not found in this organization`,
    })
  }
}

export function createInMemoryAuditLogRepository(
  seed: AuditLogRecord[] = [],
  deps: {
    users?: Pick<UserRepository, 'get'>
    apiKeys?: Pick<ApiKeyRepository, 'get'>
  } = {},
): AuditLogRepository {
  const rows = new Map(seed.map((record) => [record.id, auditLogRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): AuditLogRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Audit log organization mismatch')
      }

      if (record.actorUserId && deps.users) {
        await assertActorUserInTenant(deps.users, ctx, record.actorUserId)
      }

      if (record.actorApiKeyId && deps.apiKeys) {
        await assertActorApiKeyInTenant(deps.apiKeys, ctx, record.actorApiKeyId)
      }

      const parsed = auditLogRecordSchema.parse(record)
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

export function createSqliteAuditLogRepository(adapter: StorageAdapter): AuditLogRepository {
  const base = createTenantSqliteRepository<AuditLogRecord>(adapter, {
    tableName: 'audit_logs',
    columns: [
      'id',
      'organization_id',
      'actor_user_id',
      'actor_api_key_id',
      'entity_type',
      'entity_id',
      'action',
      'before',
      'after',
      'request_id',
      'metadata',
      'occurred_at',
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
        actor_user_id: record.actorUserId ?? null,
        actor_api_key_id: record.actorApiKeyId ?? null,
        entity_type: record.entityType,
        entity_id: record.entityId,
        action: record.action,
        before: toSqliteJson(record.before),
        after: toSqliteJson(record.after),
        request_id: record.requestId ?? null,
        metadata: toSqliteJson(record.metadata),
        occurred_at: toSqliteDate(record.occurredAt),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return auditLogRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        actorUserId: row.actor_user_id ?? null,
        actorApiKeyId: row.actor_api_key_id ?? null,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        before: fromSqliteJson(row.before, null),
        after: fromSqliteJson(row.after, null),
        requestId: row.request_id ?? null,
        metadata: fromSqliteJson(row.metadata, {}),
        occurredAt: fromSqliteDate(row.occurred_at),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)

      if (record.actorUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) => {
          return db.query<{ id: string }>(
            sql`select id from ${sql.raw('users')} where id = ${record.actorUserId} and organization_id = ${orgId} limit 1`,
          )
        })
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor user ${record.actorUserId} not found in this organization`,
          })
        }
      }

      if (record.actorApiKeyId) {
        const apiKeys = await adapter.withTenantContext(ctx, async (db) => {
          return db.query<{ id: string }>(
            sql`select id from ${sql.raw('api_keys')} where id = ${record.actorApiKeyId} and organization_id = ${orgId} limit 1`,
          )
        })
        if (!apiKeys[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor API key ${record.actorApiKeyId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    async get(ctx, id) {
      return base.get(ctx, id)
    },
    async list(ctx, query) {
      return base.list(ctx, query)
    },
  }
}

export function createPostgresAuditLogRepository(adapter: StorageAdapter): AuditLogRepository {
  const base = createTenantPostgresRepository<AuditLogRecord>(adapter, {
    tableName: 'audit_logs',
    columns: [
      'id',
      'organization_id',
      'actor_user_id',
      'actor_api_key_id',
      'entity_type',
      'entity_id',
      'action',
      'before',
      'after',
      'request_id',
      'metadata',
      'occurred_at',
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
        actor_user_id: record.actorUserId ?? null,
        actor_api_key_id: record.actorApiKeyId ?? null,
        entity_type: record.entityType,
        entity_id: record.entityId,
        action: record.action,
        before: record.before ?? null,
        after: record.after ?? null,
        request_id: record.requestId ?? null,
        metadata: record.metadata,
        occurred_at: record.occurredAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return auditLogRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        actorUserId: row.actor_user_id ?? null,
        actorApiKeyId: row.actor_api_key_id ?? null,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        before: fromPostgresJson(row.before, null),
        after: fromPostgresJson(row.after, null),
        requestId: row.request_id ?? null,
        metadata: fromPostgresJson(row.metadata, {}),
        occurredAt: fromPostgresDate(row.occurred_at),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)

      if (record.actorUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) => {
          return db.query<{ id: string }>(
            sql`select id from ${sql.raw('users')} where id = ${record.actorUserId} and organization_id = ${orgId} limit 1`,
          )
        })
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor user ${record.actorUserId} not found in this organization`,
          })
        }
      }

      if (record.actorApiKeyId) {
        const apiKeys = await adapter.withTenantContext(ctx, async (db) => {
          return db.query<{ id: string }>(
            sql`select id from ${sql.raw('api_keys')} where id = ${record.actorApiKeyId} and organization_id = ${orgId} limit 1`,
          )
        })
        if (!apiKeys[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor API key ${record.actorApiKeyId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    async get(ctx, id) {
      return base.get(ctx, id)
    },
    async list(ctx, query) {
      return base.list(ctx, query)
    },
  }
}
