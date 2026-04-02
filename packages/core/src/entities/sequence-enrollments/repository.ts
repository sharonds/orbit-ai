import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantPostgresRepository, fromPostgresDate } from '../../repositories/postgres/shared.js'
import { createTenantSqliteRepository, fromSqliteDate, toSqliteDate } from '../../repositories/sqlite/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { sequenceEnrollmentRecordSchema, type SequenceEnrollmentRecord } from './validators.js'

export interface SequenceEnrollmentRepository {
  create(ctx: OrbitAuthContext, record: SequenceEnrollmentRecord): Promise<SequenceEnrollmentRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SequenceEnrollmentRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<SequenceEnrollmentRecord>): Promise<SequenceEnrollmentRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceEnrollmentRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceEnrollmentRecord>>
}

const SEQUENCE_ENROLLMENT_SEARCHABLE_FIELDS = ['status', 'exit_reason']
const SEQUENCE_ENROLLMENT_FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'sequence_id',
  'contact_id',
  'status',
  'current_step_order',
]
const SEQUENCE_ENROLLMENT_DEFAULT_SORT = [
  { field: 'enrolled_at', direction: 'desc' as const },
  { field: 'created_at', direction: 'desc' as const },
]

export function createInMemorySequenceEnrollmentRepository(
  seed: SequenceEnrollmentRecord[] = [],
): SequenceEnrollmentRepository {
  const rows = new Map(seed.map((record) => [record.id, sequenceEnrollmentRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): SequenceEnrollmentRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Sequence enrollment organization mismatch')
      }

      const parsed = sequenceEnrollmentRecordSchema.parse(record)
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

      const next = sequenceEnrollmentRecordSchema.parse({
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
        searchableFields: SEQUENCE_ENROLLMENT_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_ENROLLMENT_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_ENROLLMENT_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEQUENCE_ENROLLMENT_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_ENROLLMENT_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_ENROLLMENT_DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteSequenceEnrollmentRepository(adapter: StorageAdapter): SequenceEnrollmentRepository {
  return createTenantSqliteRepository<SequenceEnrollmentRecord>(adapter, {
    tableName: 'sequence_enrollments',
    columns: [
      'id',
      'organization_id',
      'sequence_id',
      'contact_id',
      'status',
      'current_step_order',
      'enrolled_at',
      'exited_at',
      'exit_reason',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_ENROLLMENT_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_ENROLLMENT_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_ENROLLMENT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        sequence_id: record.sequenceId,
        contact_id: record.contactId,
        status: record.status,
        current_step_order: record.currentStepOrder,
        enrolled_at: toSqliteDate(record.enrolledAt),
        exited_at: toSqliteDate(record.exitedAt),
        exit_reason: record.exitReason ?? null,
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return sequenceEnrollmentRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        sequenceId: row.sequence_id,
        contactId: row.contact_id,
        status: row.status,
        currentStepOrder: row.current_step_order,
        enrolledAt: fromSqliteDate(row.enrolled_at),
        exitedAt: fromSqliteDate(row.exited_at),
        exitReason: row.exit_reason ?? null,
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresSequenceEnrollmentRepository(adapter: StorageAdapter): SequenceEnrollmentRepository {
  return createTenantPostgresRepository<SequenceEnrollmentRecord>(adapter, {
    tableName: 'sequence_enrollments',
    columns: [
      'id',
      'organization_id',
      'sequence_id',
      'contact_id',
      'status',
      'current_step_order',
      'enrolled_at',
      'exited_at',
      'exit_reason',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_ENROLLMENT_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_ENROLLMENT_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_ENROLLMENT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        sequence_id: record.sequenceId,
        contact_id: record.contactId,
        status: record.status,
        current_step_order: record.currentStepOrder,
        enrolled_at: record.enrolledAt,
        exited_at: record.exitedAt,
        exit_reason: record.exitReason ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return sequenceEnrollmentRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        sequenceId: row.sequence_id,
        contactId: row.contact_id,
        status: row.status,
        currentStepOrder: row.current_step_order,
        enrolledAt: fromPostgresDate(row.enrolled_at),
        exitedAt: fromPostgresDate(row.exited_at),
        exitReason: row.exit_reason ?? null,
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
