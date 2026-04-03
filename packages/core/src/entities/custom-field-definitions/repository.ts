import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import { createOrbitError } from '../../types/errors.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { customFieldDefinitionRecordSchema, type CustomFieldDefinitionRecord } from './validators.js'

export interface CustomFieldDefinitionRepository {
  create(ctx: OrbitAuthContext, record: CustomFieldDefinitionRecord): Promise<CustomFieldDefinitionRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<CustomFieldDefinitionRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<CustomFieldDefinitionRecord>>
}

const SEARCHABLE_FIELDS = ['entity_type', 'field_name', 'label']
const FILTERABLE_FIELDS = ['id', 'organization_id', 'entity_type', 'field_name', 'field_type', 'is_required', 'is_indexed', 'is_promoted']
const DEFAULT_SORT = [{ field: 'created_at', direction: 'desc' as const }]

function coerceCustomFieldDefinitionConflict(
  error: unknown,
  record: Pick<CustomFieldDefinitionRecord, 'entityType' | 'fieldName'>,
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
      message.includes('custom_fields_unique_idx') ||
      (
        message.toLowerCase().includes('unique constraint failed') &&
        message.includes('custom_field_definitions.organization_id') &&
        message.includes('custom_field_definitions.entity_type') &&
        message.includes('custom_field_definitions.field_name')
      )
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Custom field '${record.fieldName}' already exists for entity type '${record.entityType}' in this organization`,
      field: 'fieldName',
    })
  }

  throw error
}

export function createInMemoryCustomFieldDefinitionRepository(
  seed: CustomFieldDefinitionRecord[] = [],
): CustomFieldDefinitionRepository {
  const rows = new Map(seed.map((record) => [record.id, customFieldDefinitionRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): CustomFieldDefinitionRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('CustomFieldDefinition organization mismatch')
      }

      // Enforce uniqueness on (organizationId, entityType, fieldName)
      const existing = [...rows.values()].find(
        (r) =>
          r.organizationId === record.organizationId &&
          r.entityType === record.entityType &&
          r.fieldName === record.fieldName,
      )
      if (existing) {
        throw createOrbitError({
          code: 'CONFLICT',
          message: `Custom field '${record.fieldName}' already exists for entity type '${record.entityType}' in this organization`,
          field: 'fieldName',
        })
      }

      const parsed = customFieldDefinitionRecordSchema.parse(record)
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

export function createSqliteCustomFieldDefinitionRepository(
  adapter: StorageAdapter,
): CustomFieldDefinitionRepository {
  const base = createTenantSqliteRepository<CustomFieldDefinitionRecord>(adapter, {
    tableName: 'custom_field_definitions',
    columns: [
      'id',
      'organization_id',
      'entity_type',
      'field_name',
      'field_type',
      'label',
      'description',
      'is_required',
      'is_indexed',
      'is_promoted',
      'promoted_column_name',
      'default_value',
      'options',
      'validation',
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
        entity_type: record.entityType,
        field_name: record.fieldName,
        field_type: record.fieldType,
        label: record.label,
        description: record.description ?? null,
        is_required: record.isRequired ? 1 : 0,
        is_indexed: record.isIndexed ? 1 : 0,
        is_promoted: record.isPromoted ? 1 : 0,
        promoted_column_name: record.promotedColumnName ?? null,
        default_value: record.defaultValue !== undefined && record.defaultValue !== null
          ? toSqliteJson(record.defaultValue)
          : null,
        options: toSqliteJson(record.options),
        validation: toSqliteJson(record.validation),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return customFieldDefinitionRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        fieldName: row.field_name,
        fieldType: row.field_type,
        label: row.label,
        description: row.description ?? null,
        isRequired: !!row.is_required,
        isIndexed: !!row.is_indexed,
        isPromoted: !!row.is_promoted,
        promotedColumnName: row.promoted_column_name ?? null,
        defaultValue: row.default_value !== null && row.default_value !== undefined
          ? fromSqliteJson(row.default_value, null)
          : null,
        options: fromSqliteJson(row.options, []),
        validation: fromSqliteJson(row.validation, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
    onCreateError(error, record) {
      coerceCustomFieldDefinitionConflict(error, record)
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('CustomFieldDefinition organization mismatch')
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

export function createPostgresCustomFieldDefinitionRepository(
  adapter: StorageAdapter,
): CustomFieldDefinitionRepository {
  const base = createTenantPostgresRepository<CustomFieldDefinitionRecord>(adapter, {
    tableName: 'custom_field_definitions',
    columns: [
      'id',
      'organization_id',
      'entity_type',
      'field_name',
      'field_type',
      'label',
      'description',
      'is_required',
      'is_indexed',
      'is_promoted',
      'promoted_column_name',
      'default_value',
      'options',
      'validation',
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
        entity_type: record.entityType,
        field_name: record.fieldName,
        field_type: record.fieldType,
        label: record.label,
        description: record.description ?? null,
        is_required: record.isRequired,
        is_indexed: record.isIndexed,
        is_promoted: record.isPromoted,
        promoted_column_name: record.promotedColumnName ?? null,
        default_value: record.defaultValue !== undefined ? JSON.stringify(record.defaultValue) : null,
        options: JSON.stringify(record.options),
        validation: JSON.stringify(record.validation),
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return customFieldDefinitionRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        fieldName: row.field_name,
        fieldType: row.field_type,
        label: row.label,
        description: row.description ?? null,
        isRequired: !!row.is_required,
        isIndexed: !!row.is_indexed,
        isPromoted: !!row.is_promoted,
        promotedColumnName: row.promoted_column_name ?? null,
        defaultValue: row.default_value !== undefined ? fromPostgresJson(row.default_value, null) : null,
        options: fromPostgresJson(row.options, []),
        validation: fromPostgresJson(row.validation, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
    onCreateError(error, record) {
      coerceCustomFieldDefinitionConflict(error, record)
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('CustomFieldDefinition organization mismatch')
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
