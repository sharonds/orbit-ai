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
import { idempotencyKeyRecordSchema, type IdempotencyKeyRecord } from './validators.js'

export interface IdempotencyKeyRepository {
  create(ctx: OrbitAuthContext, record: IdempotencyKeyRecord): Promise<IdempotencyKeyRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<IdempotencyKeyRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<IdempotencyKeyRecord>>
}

const SEARCHABLE_FIELDS = ['key', 'method', 'path']
const FILTERABLE_FIELDS = ['id', 'organization_id', 'key', 'method', 'path', 'response_code']
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

function coerceIdempotencyKeyConflict(
  error: unknown,
  record: Pick<IdempotencyKeyRecord, 'key' | 'method' | 'path'>,
): never {
  const message = error instanceof Error ? error.message : ''
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null

  if (
    error instanceof Error &&
    (
      code === '23505' ||
      message.includes('idempotency_unique_idx') ||
      (
        message.toLowerCase().includes('unique constraint failed') &&
        message.includes('idempotency_keys.organization_id') &&
        message.includes('idempotency_keys.key') &&
        message.includes('idempotency_keys.method') &&
        message.includes('idempotency_keys.path')
      )
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Idempotency key ${record.key} with method ${record.method} and path ${record.path} already exists in this organization`,
      field: 'key',
    })
  }

  throw error
}

export function createInMemoryIdempotencyKeyRepository(
  seed: IdempotencyKeyRecord[] = [],
): IdempotencyKeyRepository {
  const rows = new Map(seed.map((record) => [record.id, idempotencyKeyRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): IdempotencyKeyRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Idempotency key organization mismatch')
      }

      // Enforce uniqueness on (organizationId, key, method, path)
      const duplicate = [...rows.values()].find(
        (r) =>
          r.organizationId === record.organizationId &&
          r.key === record.key &&
          r.method === record.method &&
          r.path === record.path,
      )
      if (duplicate) {
        throw createOrbitError({
          code: 'CONFLICT',
          message: `Idempotency key ${record.key} with method ${record.method} and path ${record.path} already exists in this organization`,
          field: 'key',
        })
      }

      const parsed = idempotencyKeyRecordSchema.parse(record)
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

export function createSqliteIdempotencyKeyRepository(adapter: StorageAdapter): IdempotencyKeyRepository {
  const base = createTenantSqliteRepository<IdempotencyKeyRecord>(adapter, {
    tableName: 'idempotency_keys',
    columns: [
      'id',
      'organization_id',
      'key',
      'method',
      'path',
      'request_hash',
      'response_code',
      'response_body',
      'locked_until',
      'completed_at',
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
        key: record.key,
        method: record.method,
        path: record.path,
        request_hash: record.requestHash,
        response_code: record.responseCode ?? null,
        response_body: record.responseBody !== undefined && record.responseBody !== null
          ? toSqliteJson(record.responseBody)
          : null,
        locked_until: record.lockedUntil ? toSqliteDate(record.lockedUntil) : null,
        completed_at: record.completedAt ? toSqliteDate(record.completedAt) : null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return idempotencyKeyRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        key: row.key,
        method: row.method,
        path: row.path,
        requestHash: row.request_hash,
        responseCode: row.response_code ?? null,
        responseBody: fromSqliteJson(row.response_body, null),
        lockedUntil: row.locked_until ? fromSqliteDate(row.locked_until) : null,
        completedAt: row.completed_at ? fromSqliteDate(row.completed_at) : null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
    onCreateError(error, record) {
      coerceIdempotencyKeyConflict(error, record)
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Idempotency key organization mismatch')
      }
      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresIdempotencyKeyRepository(adapter: StorageAdapter): IdempotencyKeyRepository {
  const base = createTenantPostgresRepository<IdempotencyKeyRecord>(adapter, {
    tableName: 'idempotency_keys',
    columns: [
      'id',
      'organization_id',
      'key',
      'method',
      'path',
      'request_hash',
      'response_code',
      'response_body',
      'locked_until',
      'completed_at',
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
        key: record.key,
        method: record.method,
        path: record.path,
        request_hash: record.requestHash,
        response_code: record.responseCode ?? null,
        response_body: record.responseBody ?? null,
        locked_until: record.lockedUntil ?? null,
        completed_at: record.completedAt ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return idempotencyKeyRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        key: row.key,
        method: row.method,
        path: row.path,
        requestHash: row.request_hash,
        responseCode: row.response_code ?? null,
        responseBody: fromPostgresJson(row.response_body, null),
        lockedUntil: row.locked_until ? fromPostgresDate(row.locked_until) : null,
        completedAt: row.completed_at ? fromPostgresDate(row.completed_at) : null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
    onCreateError(error, record) {
      coerceIdempotencyKeyConflict(error, record)
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Idempotency key organization mismatch')
      }
      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
