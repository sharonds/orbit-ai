import { sql } from 'drizzle-orm'

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
import { createTenantPostgresRepository, fromPostgresBoolean, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type {
  SchemaMigrationAdapterScope,
  SchemaMigrationForwardOperation,
} from '../../schema-engine/migrations.js'
import {
  schemaMigrationRecordSchema,
  schemaMigrationStatusPatchSchema,
  type SchemaMigrationRecord,
  type SchemaMigrationStatusPatch,
} from './validators.js'
import type { UserRepository } from '../users/repository.js'

export interface SchemaMigrationRepository {
  create(ctx: OrbitAuthContext, record: SchemaMigrationRecord): Promise<SchemaMigrationRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SchemaMigrationRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SchemaMigrationRecord>>
  updateStatus(ctx: OrbitAuthContext, id: string, patch: SchemaMigrationStatusPatch): Promise<SchemaMigrationRecord | null>
  assertRollbackPreconditions(
    ctx: OrbitAuthContext,
    input: SchemaMigrationRollbackPreconditionInput,
  ): Promise<SchemaMigrationRecord>
  withMigrationLock<T>(
    ctx: OrbitAuthContext,
    scope: SchemaMigrationLockScope,
    fn: () => Promise<T>,
  ): Promise<SchemaMigrationLockResult<T>>
}

export interface SchemaMigrationRollbackPreconditionInput {
  migrationId: string
  adapter: SchemaMigrationAdapterScope
}

export interface SchemaMigrationLockScope {
  adapter: SchemaMigrationAdapterScope
  target: string
}

export interface SchemaMigrationLockState {
  key: string
  orgId: string
  adapter: SchemaMigrationAdapterScope
  target: string
  acquired: boolean
  contended: boolean
  released: boolean
  acquiredAt: Date
  releasedAt: Date | null
}

export interface SchemaMigrationLockResult<T> {
  result: T
  lock: SchemaMigrationLockState
}

const SEARCHABLE_FIELDS = ['description', 'entity_type', 'operation_type', 'checksum', 'status']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'checksum',
  'status',
  'entity_type',
  'operation_type',
  'adapter',
  'applied_by',
  'applied_by_user_id',
  'approved_by_user_id',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]
const lockRegistry = new Map<string, SchemaMigrationLockState>()

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

function createLockKey(orgId: string, scope: SchemaMigrationLockScope): string {
  return `${orgId}:${scope.adapter.name}:${scope.adapter.dialect}:${scope.target}`
}

function createLockConflictError(lock: SchemaMigrationLockState) {
  return createOrbitError({
    code: 'MIGRATION_CONFLICT',
    message: 'A schema migration is already in flight for this organization, adapter, and target',
    retryable: true,
    details: {
      key: lock.key,
      adapter: lock.adapter.name,
      target: lock.target,
      acquired: false,
      contended: true,
      released: false,
    },
  })
}

async function withInProcessMigrationLock<T>(
  ctx: OrbitAuthContext,
  scope: SchemaMigrationLockScope,
  fn: () => Promise<T>,
): Promise<SchemaMigrationLockResult<T>> {
  const orgId = assertOrgContext(ctx)
  const key = createLockKey(orgId, scope)
  const existing = lockRegistry.get(key)
  if (existing) {
    throw createLockConflictError(existing)
  }

  const lock: SchemaMigrationLockState = {
    key,
    orgId,
    adapter: scope.adapter,
    target: scope.target,
    acquired: true,
    contended: false,
    released: false,
    acquiredAt: new Date(),
    releasedAt: null,
  }
  lockRegistry.set(key, lock)
  try {
    const result = await fn()
    return { result, lock }
  } finally {
    lock.released = true
    lock.releasedAt = new Date()
    lockRegistry.delete(key)
  }
}

async function withAdapterMigrationLock<T>(
  adapter: StorageAdapter,
  ctx: OrbitAuthContext,
  scope: SchemaMigrationLockScope,
  fn: () => Promise<T>,
): Promise<SchemaMigrationLockResult<T>> {
  if (adapter.dialect !== 'postgres') {
    return withInProcessMigrationLock(ctx, scope, fn)
  }

  const orgId = assertOrgContext(ctx)
  const key = createLockKey(orgId, scope)
  const lockRef: { current?: SchemaMigrationLockState } = {}

  try {
    return await adapter.runWithMigrationAuthority(async (db) =>
      db.transaction(async (tx) => {
        const rows = await tx.query<{ acquired: boolean | 't' | 'f' }>(
          sql`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as acquired`,
        )
        const acquired = rows[0]?.acquired === true || rows[0]?.acquired === 't'
        if (!acquired) {
          throw createLockConflictError({
            key,
            orgId,
            adapter: scope.adapter,
            target: scope.target,
            acquired: false,
            contended: true,
            released: false,
            acquiredAt: new Date(),
            releasedAt: null,
          })
        }

        const lock: SchemaMigrationLockState = {
          key,
          orgId,
          adapter: scope.adapter,
          target: scope.target,
          acquired: true,
          contended: false,
          released: false,
          acquiredAt: new Date(),
          releasedAt: null,
        }
        lockRef.current = lock
        const result = await fn()
        return { result, lock }
      }),
    )
  } finally {
    if (lockRef.current) {
      lockRef.current.released = true
      lockRef.current.releasedAt = new Date()
    }
  }
}

function sameAdapter(a: SchemaMigrationAdapterScope, b: SchemaMigrationAdapterScope): boolean {
  return a.name === b.name && a.dialect === b.dialect
}

function migrationTimestamp(record: SchemaMigrationRecord): number {
  return (record.appliedAt ?? record.startedAt ?? record.createdAt).getTime()
}

function extractOperationTargets(operation: SchemaMigrationForwardOperation): string[] {
  switch (operation.type) {
    case 'custom_field.add':
    case 'custom_field.update':
    case 'custom_field.delete':
    case 'custom_field.rename':
    case 'custom_field.promote':
      return [`entity:${operation.entityType}`]
    case 'column.add':
    case 'column.drop':
    case 'column.rename':
    case 'index.add':
    case 'index.drop':
      return [`table:${operation.tableName}`]
    case 'adapter.semantic': {
      const tableName = operation.parameters?.tableName
      const entityType = operation.parameters?.entityType
      if (typeof tableName === 'string') return [`table:${tableName}`]
      if (typeof entityType === 'string') return [`entity:${entityType}`]
      return [`adapter:${operation.operation}`]
    }
  }
}

function extractMigrationTargets(record: SchemaMigrationRecord): Set<string> {
  const targets = new Set<string>()
  for (const operation of record.forwardOperations) {
    for (const target of extractOperationTargets(operation)) {
      targets.add(target)
    }
  }
  return targets.size > 0 ? targets : new Set([`adapter:${record.adapter.name}`])
}

function hasTargetOverlap(a: SchemaMigrationRecord, b: SchemaMigrationRecord): boolean {
  const aTargets = extractMigrationTargets(a)
  for (const target of extractMigrationTargets(b)) {
    if (aTargets.has(target)) return true
  }
  return false
}

function rollbackPreconditionError(message: string, details?: Record<string, unknown>) {
  return createOrbitError({
    code: 'ROLLBACK_PRECONDITION_FAILED',
    message,
    details,
  })
}

async function listAllSchemaMigrations(
  repository: Pick<SchemaMigrationRepository, 'list'>,
  ctx: OrbitAuthContext,
): Promise<SchemaMigrationRecord[]> {
  const records: SchemaMigrationRecord[] = []
  let cursor: string | null | undefined
  do {
    const page = await repository.list(ctx, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    records.push(...page.data)
    cursor = page.nextCursor
  } while (cursor)
  return records
}

function buildStatusUpdatePatch(patch: SchemaMigrationStatusPatch): Partial<SchemaMigrationRecord> {
  const parsedPatch = schemaMigrationStatusPatchSchema.parse(patch)
  const next: Partial<SchemaMigrationRecord> = {
    status: parsedPatch.status,
    updatedAt: new Date(),
  }

  if (parsedPatch.startedAt !== undefined) next.startedAt = parsedPatch.startedAt
  if (parsedPatch.appliedAt !== undefined) next.appliedAt = parsedPatch.appliedAt
  if (parsedPatch.rolledBackAt !== undefined) next.rolledBackAt = parsedPatch.rolledBackAt
  if (parsedPatch.failedAt !== undefined) next.failedAt = parsedPatch.failedAt
  if (parsedPatch.errorCode !== undefined) next.errorCode = parsedPatch.errorCode
  if (parsedPatch.errorMessage !== undefined) next.errorMessage = parsedPatch.errorMessage
  if (parsedPatch.appliedBy !== undefined) next.appliedBy = parsedPatch.appliedBy

  return next
}

async function assertRollbackPreconditionsFromRows(
  ctx: OrbitAuthContext,
  input: SchemaMigrationRollbackPreconditionInput,
  rows: SchemaMigrationRecord[],
): Promise<SchemaMigrationRecord> {
  assertOrgContext(ctx)
  const record = rows.find((candidate) => candidate.id === input.migrationId) ?? null
  if (!record) {
    throw createOrbitError({
      code: 'RESOURCE_NOT_FOUND',
      message: `Schema migration ${input.migrationId} not found`,
    })
  }

  if (!sameAdapter(record.adapter, input.adapter)) {
    throw rollbackPreconditionError('Schema migration was created for a different adapter', {
      migrationId: record.id,
      adapter: input.adapter.name,
      expectedAdapter: record.adapter.name,
    })
  }
  if (record.status !== 'applied') {
    throw rollbackPreconditionError('Only applied schema migrations can be rolled back', {
      migrationId: record.id,
      status: record.status,
    })
  }
  if (record.reverseOperations.length === 0) {
    throw rollbackPreconditionError('Schema migration has no stored reverse operations', {
      migrationId: record.id,
    })
  }

  const recordTime = migrationTimestamp(record)
  const blocking = rows.find((candidate) =>
    candidate.id !== record.id &&
    candidate.status === 'applied' &&
    candidate.rolledBackAt === null &&
    sameAdapter(candidate.adapter, record.adapter) &&
    migrationTimestamp(candidate) > recordTime &&
    hasTargetOverlap(record, candidate)
  )
  if (blocking) {
    throw rollbackPreconditionError('A newer applied schema migration depends on the same target', {
      migrationId: record.id,
      blockingMigrationId: blocking.id,
      targets: [...extractMigrationTargets(record)],
    })
  }

  return record
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
    async updateStatus(ctx, id, patch) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      if (!record || record.organizationId !== orgId) return null
      const next = schemaMigrationRecordSchema.parse({
        ...record,
        ...buildStatusUpdatePatch(patch),
      })
      rows.set(next.id, next)
      return next
    },
    async assertRollbackPreconditions(ctx, input) {
      return assertRollbackPreconditionsFromRows(ctx, input, scopedRows(ctx))
    },
    async withMigrationLock(ctx, scope, fn) {
      return withInProcessMigrationLock(ctx, scope, fn)
    },
  }
}

export function createSqliteSchemaMigrationRepository(adapter: StorageAdapter): SchemaMigrationRepository {
  const base = createTenantSqliteRepository<SchemaMigrationRecord>(adapter, {
    tableName: 'schema_migrations',
    columns: [
      'id',
      'organization_id',
      'checksum',
      'adapter',
      'description',
      'entity_type',
      'operation_type',
      'forward_operations',
      'reverse_operations',
      'destructive',
      'status',
      'sql_statements',
      'rollback_statements',
      'applied_by',
      'applied_by_user_id',
      'approved_by_user_id',
      'started_at',
      'applied_at',
      'rolled_back_at',
      'failed_at',
      'error_code',
      'error_message',
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
        checksum: record.checksum,
        adapter: toSqliteJson(record.adapter),
        description: record.description,
        entity_type: record.entityType ?? null,
        operation_type: record.operationType,
        forward_operations: toSqliteJson(record.forwardOperations),
        reverse_operations: toSqliteJson(record.reverseOperations),
        destructive: toSqliteBoolean(record.destructive),
        status: record.status,
        sql_statements: toSqliteJson(record.sqlStatements),
        rollback_statements: toSqliteJson(record.rollbackStatements),
        applied_by: record.appliedBy ?? null,
        applied_by_user_id: record.appliedByUserId ?? null,
        approved_by_user_id: record.approvedByUserId ?? null,
        started_at: record.startedAt ? toSqliteDate(record.startedAt) : null,
        applied_at: record.appliedAt ? toSqliteDate(record.appliedAt) : null,
        rolled_back_at: record.rolledBackAt ? toSqliteDate(record.rolledBackAt) : null,
        failed_at: record.failedAt ? toSqliteDate(record.failedAt) : null,
        error_code: record.errorCode ?? null,
        error_message: record.errorMessage ?? null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return schemaMigrationRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        checksum: row.checksum,
        adapter: fromSqliteJson(row.adapter, null),
        description: row.description,
        entityType: row.entity_type ?? null,
        operationType: row.operation_type,
        forwardOperations: fromSqliteJson(row.forward_operations, []),
        reverseOperations: fromSqliteJson(row.reverse_operations, []),
        destructive: fromSqliteBoolean(row.destructive),
        status: row.status,
        sqlStatements: fromSqliteJson(row.sql_statements, []),
        rollbackStatements: fromSqliteJson(row.rollback_statements, []),
        appliedBy: row.applied_by ?? null,
        appliedByUserId: row.applied_by_user_id ?? null,
        approvedByUserId: row.approved_by_user_id ?? null,
        startedAt: row.started_at ? fromSqliteDate(row.started_at) : null,
        appliedAt: row.applied_at ? fromSqliteDate(row.applied_at) : null,
        rolledBackAt: row.rolled_back_at ? fromSqliteDate(row.rolled_back_at) : null,
        failedAt: row.failed_at ? fromSqliteDate(row.failed_at) : null,
        errorCode: row.error_code ?? null,
        errorMessage: row.error_message ?? null,
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
    async updateStatus(ctx, id, patch) {
      return base.update(ctx, id, buildStatusUpdatePatch(patch))
    },
    async assertRollbackPreconditions(ctx, input) {
      return assertRollbackPreconditionsFromRows(ctx, input, await listAllSchemaMigrations(base, ctx))
    },
    async withMigrationLock(ctx, scope, fn) {
      return withAdapterMigrationLock(adapter, ctx, scope, fn)
    },
  }
}

export function createPostgresSchemaMigrationRepository(adapter: StorageAdapter): SchemaMigrationRepository {
  const base = createTenantPostgresRepository<SchemaMigrationRecord>(adapter, {
    tableName: 'schema_migrations',
    columns: [
      'id',
      'organization_id',
      'checksum',
      'adapter',
      'description',
      'entity_type',
      'operation_type',
      'forward_operations',
      'reverse_operations',
      'destructive',
      'status',
      'sql_statements',
      'rollback_statements',
      'applied_by',
      'applied_by_user_id',
      'approved_by_user_id',
      'started_at',
      'applied_at',
      'rolled_back_at',
      'failed_at',
      'error_code',
      'error_message',
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
        checksum: record.checksum,
        adapter: record.adapter,
        description: record.description,
        entity_type: record.entityType ?? null,
        operation_type: record.operationType,
        forward_operations: record.forwardOperations,
        reverse_operations: record.reverseOperations,
        destructive: record.destructive,
        status: record.status,
        sql_statements: JSON.stringify(record.sqlStatements),
        rollback_statements: JSON.stringify(record.rollbackStatements),
        applied_by: record.appliedBy ?? null,
        applied_by_user_id: record.appliedByUserId ?? null,
        approved_by_user_id: record.approvedByUserId ?? null,
        started_at: record.startedAt ?? null,
        applied_at: record.appliedAt ?? null,
        rolled_back_at: record.rolledBackAt ?? null,
        failed_at: record.failedAt ?? null,
        error_code: record.errorCode ?? null,
        error_message: record.errorMessage ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return schemaMigrationRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        checksum: row.checksum,
        adapter: fromPostgresJson(row.adapter, null),
        description: row.description,
        entityType: row.entity_type ?? null,
        operationType: row.operation_type,
        forwardOperations: fromPostgresJson(row.forward_operations, []),
        reverseOperations: fromPostgresJson(row.reverse_operations, []),
        destructive: fromPostgresBoolean(row.destructive),
        status: row.status,
        sqlStatements: fromPostgresJson(row.sql_statements, []),
        rollbackStatements: fromPostgresJson(row.rollback_statements, []),
        appliedBy: row.applied_by ?? null,
        appliedByUserId: row.applied_by_user_id ?? null,
        approvedByUserId: row.approved_by_user_id ?? null,
        startedAt: row.started_at ? fromPostgresDate(row.started_at) : null,
        appliedAt: row.applied_at ? fromPostgresDate(row.applied_at) : null,
        rolledBackAt: row.rolled_back_at ? fromPostgresDate(row.rolled_back_at) : null,
        failedAt: row.failed_at ? fromPostgresDate(row.failed_at) : null,
        errorCode: row.error_code ?? null,
        errorMessage: row.error_message ?? null,
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
    async updateStatus(ctx, id, patch) {
      return base.update(ctx, id, buildStatusUpdatePatch(patch))
    },
    async assertRollbackPreconditions(ctx, input) {
      return assertRollbackPreconditionsFromRows(ctx, input, await listAllSchemaMigrations(base, ctx))
    },
    async withMigrationLock(ctx, scope, fn) {
      return withInProcessMigrationLock(ctx, scope, fn)
    },
  }
}
