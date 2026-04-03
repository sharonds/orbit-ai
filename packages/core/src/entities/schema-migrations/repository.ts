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
import { schemaMigrationRecordSchema, type SchemaMigrationRecord } from './validators.js'
import type { UserRepository } from '../users/repository.js'

export interface SchemaMigrationRepository {
  create(ctx: OrbitAuthContext, record: SchemaMigrationRecord): Promise<SchemaMigrationRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SchemaMigrationRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SchemaMigrationRecord>>
}

const SEARCHABLE_FIELDS = ['description', 'entity_type', 'operation_type']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'entity_type',
  'operation_type',
  'applied_by_user_id',
  'approved_by_user_id',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

async function assertUserInTenant(
  users: Pick<UserRepository, 'get'>,
  ctx: OrbitAuthContext,
  userId: string,
  role: string,
): Promise<void> {
  const user = await users.get(ctx, userId)
  if (!user) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `${role} user ${userId} not found in this organization`,
    })
  }
}

export function createInMemorySchemaMigrationRepository(
  seed: SchemaMigrationRecord[] = [],
  deps: {
    users?: Pick<UserRepository, 'get'>
  } = {},
): SchemaMigrationRepository {
  const rows = new Map(seed.map((record) => [record.id, schemaMigrationRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): SchemaMigrationRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Schema migration organization mismatch')
      }

      if (deps.users) {
        if (record.appliedByUserId) {
          await assertUserInTenant(deps.users, ctx, record.appliedByUserId, 'appliedByUserId')
        }
        if (record.approvedByUserId) {
          await assertUserInTenant(deps.users, ctx, record.approvedByUserId, 'approvedByUserId')
        }
      }

      const parsed = schemaMigrationRecordSchema.parse(record)
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

export function createSqliteSchemaMigrationRepository(adapter: StorageAdapter): SchemaMigrationRepository {
  const base = createTenantSqliteRepository<SchemaMigrationRecord>(adapter, {
    tableName: 'schema_migrations',
    columns: [
      'id',
      'organization_id',
      'description',
      'entity_type',
      'operation_type',
      'sql_statements',
      'rollback_statements',
      'applied_by_user_id',
      'approved_by_user_id',
      'applied_at',
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
        description: record.description,
        entity_type: record.entityType ?? null,
        operation_type: record.operationType,
        sql_statements: toSqliteJson(record.sqlStatements),
        rollback_statements: toSqliteJson(record.rollbackStatements),
        applied_by_user_id: record.appliedByUserId ?? null,
        approved_by_user_id: record.approvedByUserId ?? null,
        applied_at: record.appliedAt ? toSqliteDate(record.appliedAt) : null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return schemaMigrationRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        description: row.description,
        entityType: row.entity_type ?? null,
        operationType: row.operation_type,
        sqlStatements: fromSqliteJson(row.sql_statements, []),
        rollbackStatements: fromSqliteJson(row.rollback_statements, []),
        appliedByUserId: row.applied_by_user_id ?? null,
        approvedByUserId: row.approved_by_user_id ?? null,
        appliedAt: row.applied_at ? fromSqliteDate(row.applied_at) : null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Schema migration organization mismatch')
      }

      if (record.appliedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.appliedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `appliedByUserId user ${record.appliedByUserId} not found in this organization`,
          })
        }
      }

      if (record.approvedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.approvedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `approvedByUserId user ${record.approvedByUserId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresSchemaMigrationRepository(adapter: StorageAdapter): SchemaMigrationRepository {
  const base = createTenantPostgresRepository<SchemaMigrationRecord>(adapter, {
    tableName: 'schema_migrations',
    columns: [
      'id',
      'organization_id',
      'description',
      'entity_type',
      'operation_type',
      'sql_statements',
      'rollback_statements',
      'applied_by_user_id',
      'approved_by_user_id',
      'applied_at',
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
        description: record.description,
        entity_type: record.entityType ?? null,
        operation_type: record.operationType,
        sql_statements: JSON.stringify(record.sqlStatements),
        rollback_statements: JSON.stringify(record.rollbackStatements),
        applied_by_user_id: record.appliedByUserId ?? null,
        approved_by_user_id: record.approvedByUserId ?? null,
        applied_at: record.appliedAt ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return schemaMigrationRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        description: row.description,
        entityType: row.entity_type ?? null,
        operationType: row.operation_type,
        sqlStatements: fromPostgresJson(row.sql_statements, []),
        rollbackStatements: fromPostgresJson(row.rollback_statements, []),
        appliedByUserId: row.applied_by_user_id ?? null,
        approvedByUserId: row.approved_by_user_id ?? null,
        appliedAt: row.applied_at ? fromPostgresDate(row.applied_at) : null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Schema migration organization mismatch')
      }

      if (record.appliedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.appliedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `appliedByUserId user ${record.appliedByUserId} not found in this organization`,
          })
        }
      }

      if (record.approvedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.approvedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `approvedByUserId user ${record.approvedByUserId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
