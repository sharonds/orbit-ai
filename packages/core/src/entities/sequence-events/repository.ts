import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { createTenantSqliteRepository, fromSqliteDate, fromSqliteJson, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { sequenceEventRecordSchema, type SequenceEventRecord } from './validators.js'

export interface SequenceEventRepository {
  create(ctx: OrbitAuthContext, record: SequenceEventRecord): Promise<SequenceEventRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SequenceEventRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceEventRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceEventRecord>>
}

const SEQUENCE_EVENT_SEARCHABLE_FIELDS = ['event_type', 'payload']
const SEQUENCE_EVENT_FILTERABLE_FIELDS = ['id', 'organization_id', 'sequence_enrollment_id', 'sequence_step_id', 'event_type', 'occurred_at']
const SEQUENCE_EVENT_DEFAULT_SORT = [
  { field: 'occurred_at', direction: 'desc' as const },
  { field: 'created_at', direction: 'desc' as const },
]

export function createInMemorySequenceEventRepository(seed: SequenceEventRecord[] = []): SequenceEventRepository {
  const rows = new Map(seed.map((record) => [record.id, sequenceEventRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): SequenceEventRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Sequence event organization mismatch')
      }

      const parsed = sequenceEventRecordSchema.parse(record)
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
        searchableFields: SEQUENCE_EVENT_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_EVENT_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_EVENT_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEQUENCE_EVENT_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_EVENT_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_EVENT_DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteSequenceEventRepository(adapter: StorageAdapter): SequenceEventRepository {
  return createTenantSqliteRepository<SequenceEventRecord>(adapter, {
    tableName: 'sequence_events',
    columns: [
      'id',
      'organization_id',
      'sequence_enrollment_id',
      'sequence_step_id',
      'event_type',
      'payload',
      'occurred_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_EVENT_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_EVENT_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_EVENT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        sequence_enrollment_id: record.sequenceEnrollmentId,
        sequence_step_id: record.sequenceStepId ?? null,
        event_type: record.eventType,
        payload: toSqliteJson(record.payload),
        occurred_at: toSqliteDate(record.occurredAt),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return sequenceEventRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        sequenceEnrollmentId: row.sequence_enrollment_id,
        sequenceStepId: row.sequence_step_id ?? null,
        eventType: row.event_type,
        payload: fromSqliteJson(row.payload, {}),
        occurredAt: fromSqliteDate(row.occurred_at),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresSequenceEventRepository(adapter: StorageAdapter): SequenceEventRepository {
  return createTenantPostgresRepository<SequenceEventRecord>(adapter, {
    tableName: 'sequence_events',
    columns: [
      'id',
      'organization_id',
      'sequence_enrollment_id',
      'sequence_step_id',
      'event_type',
      'payload',
      'occurred_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_EVENT_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_EVENT_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_EVENT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        sequence_enrollment_id: record.sequenceEnrollmentId,
        sequence_step_id: record.sequenceStepId ?? null,
        event_type: record.eventType,
        payload: record.payload,
        occurred_at: record.occurredAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return sequenceEventRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        sequenceEnrollmentId: row.sequence_enrollment_id,
        sequenceStepId: row.sequence_step_id ?? null,
        eventType: row.event_type,
        payload: fromPostgresJson(row.payload, {}),
        occurredAt: fromPostgresDate(row.occurred_at),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
