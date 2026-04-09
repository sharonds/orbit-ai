import type { OrbitAuthContext, OrbitDatabase, StorageAdapter } from '../../adapters/interface.js'
import { createTxBoundAdapter } from '../../adapters/tx-bound-adapter.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { createTenantSqliteRepository, fromSqliteDate, fromSqliteJson, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { sequenceStepRecordSchema, type SequenceStepRecord } from './validators.js'

export interface SequenceStepRepository {
  create(ctx: OrbitAuthContext, record: SequenceStepRecord): Promise<SequenceStepRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SequenceStepRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<SequenceStepRecord>): Promise<SequenceStepRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceStepRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceStepRecord>>
  /** See `SequenceRepository.withDatabase` — same contract. */
  withDatabase(txDb: OrbitDatabase): SequenceStepRepository
}

const SEQUENCE_STEP_SEARCHABLE_FIELDS = ['action_type', 'template_subject', 'template_body', 'task_title', 'task_description']
const SEQUENCE_STEP_FILTERABLE_FIELDS = ['id', 'organization_id', 'sequence_id', 'step_order', 'action_type']
const SEQUENCE_STEP_DEFAULT_SORT = [
  { field: 'sequence_id', direction: 'asc' as const },
  { field: 'step_order', direction: 'asc' as const },
  { field: 'created_at', direction: 'desc' as const },
]

export function createInMemorySequenceStepRepository(seed: SequenceStepRecord[] = []): SequenceStepRepository {
  const rows = new Map(seed.map((record) => [record.id, sequenceStepRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): SequenceStepRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const repo: SequenceStepRepository = {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Sequence step organization mismatch')
      }

      const parsed = sequenceStepRecordSchema.parse(record)
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

      const next = sequenceStepRecordSchema.parse({
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
        searchableFields: SEQUENCE_STEP_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_STEP_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_STEP_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEQUENCE_STEP_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_STEP_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_STEP_DEFAULT_SORT,
      })
    },
    withDatabase() {
      return repo
    },
  }
  return repo
}

export function createSqliteSequenceStepRepository(adapter: StorageAdapter): SequenceStepRepository {
  const base = createTenantSqliteRepository<SequenceStepRecord>(adapter, {
    tableName: 'sequence_steps',
    columns: [
      'id',
      'organization_id',
      'sequence_id',
      'step_order',
      'action_type',
      'delay_minutes',
      'template_subject',
      'template_body',
      'task_title',
      'task_description',
      'metadata',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_STEP_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_STEP_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_STEP_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        sequence_id: record.sequenceId,
        step_order: record.stepOrder,
        action_type: record.actionType,
        delay_minutes: record.delayMinutes,
        template_subject: record.templateSubject ?? null,
        template_body: record.templateBody ?? null,
        task_title: record.taskTitle ?? null,
        task_description: record.taskDescription ?? null,
        metadata: toSqliteJson(record.metadata),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return sequenceStepRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        sequenceId: row.sequence_id,
        stepOrder: row.step_order,
        actionType: row.action_type,
        delayMinutes: row.delay_minutes,
        templateSubject: row.template_subject ?? null,
        templateBody: row.template_body ?? null,
        taskTitle: row.task_title ?? null,
        taskDescription: row.task_description ?? null,
        metadata: fromSqliteJson(row.metadata, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createSqliteSequenceStepRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}

export function createPostgresSequenceStepRepository(adapter: StorageAdapter): SequenceStepRepository {
  const base = createTenantPostgresRepository<SequenceStepRecord>(adapter, {
    tableName: 'sequence_steps',
    columns: [
      'id',
      'organization_id',
      'sequence_id',
      'step_order',
      'action_type',
      'delay_minutes',
      'template_subject',
      'template_body',
      'task_title',
      'task_description',
      'metadata',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_STEP_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_STEP_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_STEP_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        sequence_id: record.sequenceId,
        step_order: record.stepOrder,
        action_type: record.actionType,
        delay_minutes: record.delayMinutes,
        template_subject: record.templateSubject ?? null,
        template_body: record.templateBody ?? null,
        task_title: record.taskTitle ?? null,
        task_description: record.taskDescription ?? null,
        metadata: record.metadata,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return sequenceStepRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        sequenceId: row.sequence_id,
        stepOrder: row.step_order,
        actionType: row.action_type,
        delayMinutes: row.delay_minutes,
        templateSubject: row.template_subject ?? null,
        templateBody: row.template_body ?? null,
        taskTitle: row.task_title ?? null,
        taskDescription: row.task_description ?? null,
        metadata: fromPostgresJson(row.metadata, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createPostgresSequenceStepRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}
