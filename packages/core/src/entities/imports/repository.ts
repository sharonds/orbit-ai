import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantPostgresRepository, fromPostgresDate } from '../../repositories/postgres/shared.js'
import { createTenantSqliteRepository, fromSqliteDate, toSqliteDate } from '../../repositories/sqlite/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { importRecordSchema, type ImportRecord } from './validators.js'

export interface ImportRepository {
  create(ctx: OrbitAuthContext, record: ImportRecord): Promise<ImportRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ImportRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<ImportRecord>): Promise<ImportRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ImportRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ImportRecord>>
}

const IMPORT_SEARCHABLE_FIELDS = ['entity_type', 'file_name', 'status']
const IMPORT_FILTERABLE_FIELDS = ['id', 'organization_id', 'entity_type', 'status', 'started_by_user_id']
const IMPORT_DEFAULT_SORT = [{ field: 'created_at', direction: 'desc' as const }]

export function createInMemoryImportRepository(seed: ImportRecord[] = []): ImportRepository {
  const rows = new Map(seed.map((record) => [record.id, importRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): ImportRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Import organization mismatch')
      }

      const parsed = importRecordSchema.parse(record)
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

      const next = importRecordSchema.parse({
        ...current,
        ...patch,
      })
      rows.set(id, next)
      return next
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: IMPORT_SEARCHABLE_FIELDS,
        filterableFields: IMPORT_FILTERABLE_FIELDS,
        defaultSort: IMPORT_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: IMPORT_SEARCHABLE_FIELDS,
        filterableFields: IMPORT_FILTERABLE_FIELDS,
        defaultSort: IMPORT_DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteImportRepository(adapter: StorageAdapter): ImportRepository {
  return createTenantSqliteRepository<ImportRecord>(adapter, {
    tableName: 'imports',
    columns: [
      'id',
      'organization_id',
      'entity_type',
      'file_name',
      'total_rows',
      'created_rows',
      'updated_rows',
      'skipped_rows',
      'failed_rows',
      'status',
      'started_by_user_id',
      'completed_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: IMPORT_SEARCHABLE_FIELDS,
    filterableFields: IMPORT_FILTERABLE_FIELDS,
    defaultSort: IMPORT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        entity_type: record.entityType,
        file_name: record.fileName,
        total_rows: record.totalRows,
        created_rows: record.createdRows,
        updated_rows: record.updatedRows,
        skipped_rows: record.skippedRows,
        failed_rows: record.failedRows,
        status: record.status,
        started_by_user_id: record.startedByUserId ?? null,
        completed_at: record.completedAt ? toSqliteDate(record.completedAt) : null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return importRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        fileName: row.file_name,
        totalRows: row.total_rows,
        createdRows: row.created_rows,
        updatedRows: row.updated_rows,
        skippedRows: row.skipped_rows,
        failedRows: row.failed_rows,
        status: row.status,
        startedByUserId: row.started_by_user_id ?? null,
        completedAt: row.completed_at ? fromSqliteDate(row.completed_at) : null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresImportRepository(adapter: StorageAdapter): ImportRepository {
  return createTenantPostgresRepository<ImportRecord>(adapter, {
    tableName: 'imports',
    columns: [
      'id',
      'organization_id',
      'entity_type',
      'file_name',
      'total_rows',
      'created_rows',
      'updated_rows',
      'skipped_rows',
      'failed_rows',
      'status',
      'started_by_user_id',
      'completed_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: IMPORT_SEARCHABLE_FIELDS,
    filterableFields: IMPORT_FILTERABLE_FIELDS,
    defaultSort: IMPORT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        entity_type: record.entityType,
        file_name: record.fileName,
        total_rows: record.totalRows,
        created_rows: record.createdRows,
        updated_rows: record.updatedRows,
        skipped_rows: record.skippedRows,
        failed_rows: record.failedRows,
        status: record.status,
        started_by_user_id: record.startedByUserId ?? null,
        completed_at: record.completedAt ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return importRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        fileName: row.file_name,
        totalRows: row.total_rows,
        createdRows: row.created_rows,
        updatedRows: row.updated_rows,
        skippedRows: row.skipped_rows,
        failedRows: row.failed_rows,
        status: row.status,
        startedByUserId: row.started_by_user_id ?? null,
        completedAt: row.completed_at ? fromPostgresDate(row.completed_at) : null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
