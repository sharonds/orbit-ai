import type { OrbitAuthContext, OrbitDatabase, StorageAdapter } from '../../adapters/interface.js'
import { createTxBoundAdapter } from '../../adapters/tx-bound-adapter.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { createTenantSqliteRepository, fromSqliteDate, fromSqliteJson, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { sequenceRecordSchema, type SequenceRecord } from './validators.js'

export interface SequenceRepository {
  create(ctx: OrbitAuthContext, record: SequenceRecord): Promise<SequenceRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SequenceRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<SequenceRecord>): Promise<SequenceRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceRecord>>
  /**
   * Return a copy of this repository whose queries run against the supplied
   * transaction-scoped database handle. Used by services that wrap a multi-step
   * read-then-write in `TransactionScope.run()` so the inner reads and writes
   * share a single transaction. In-memory repositories return `this` (no-op).
   */
  withDatabase(txDb: OrbitDatabase): SequenceRepository
}

const SEQUENCE_SEARCHABLE_FIELDS = ['name', 'description', 'trigger_event', 'status']
const SEQUENCE_FILTERABLE_FIELDS = ['id', 'organization_id', 'name', 'trigger_event', 'status']
const SEQUENCE_DEFAULT_SORT = [{ field: 'created_at', direction: 'desc' as const }]

export function createInMemorySequenceRepository(seed: SequenceRecord[] = []): SequenceRepository {
  const rows = new Map(seed.map((record) => [record.id, sequenceRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): SequenceRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const repo: SequenceRepository = {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Sequence organization mismatch')
      }

      const parsed = sequenceRecordSchema.parse(record)
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

      const next = sequenceRecordSchema.parse({
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
        searchableFields: SEQUENCE_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEQUENCE_SEARCHABLE_FIELDS,
        filterableFields: SEQUENCE_FILTERABLE_FIELDS,
        defaultSort: SEQUENCE_DEFAULT_SORT,
      })
    },
    withDatabase() {
      // In-memory repository has no database handle to swap — every method
      // already operates on the same in-process Map. Returning the same
      // instance keeps `tx.run()` correctly scoped to a single shared store.
      return repo
    },
  }
  return repo
}

export function createSqliteSequenceRepository(adapter: StorageAdapter): SequenceRepository {
  const base = createTenantSqliteRepository<SequenceRecord>(adapter, {
    tableName: 'sequences',
    columns: [
      'id',
      'organization_id',
      'name',
      'description',
      'trigger_event',
      'status',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        description: record.description ?? null,
        trigger_event: record.triggerEvent ?? null,
        status: record.status,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return sequenceRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        description: row.description ?? null,
        triggerEvent: row.trigger_event ?? null,
        status: row.status,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createSqliteSequenceRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}

export function createPostgresSequenceRepository(adapter: StorageAdapter): SequenceRepository {
  const base = createTenantPostgresRepository<SequenceRecord>(adapter, {
    tableName: 'sequences',
    columns: [
      'id',
      'organization_id',
      'name',
      'description',
      'trigger_event',
      'status',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEQUENCE_SEARCHABLE_FIELDS,
    filterableFields: SEQUENCE_FILTERABLE_FIELDS,
    defaultSort: SEQUENCE_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        description: record.description ?? null,
        trigger_event: record.triggerEvent ?? null,
        status: record.status,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return sequenceRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        description: row.description ?? null,
        triggerEvent: row.trigger_event ?? null,
        status: row.status,
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
  return {
    ...base,
    withDatabase(txDb) {
      return createPostgresSequenceRepository(createTxBoundAdapter(adapter, txDb))
    },
  }
}
