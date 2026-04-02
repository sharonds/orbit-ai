import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
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
import { taskRecordSchema, type TaskRecord } from './validators.js'

export interface TaskRepository {
  create(ctx: OrbitAuthContext, record: TaskRecord): Promise<TaskRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<TaskRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<TaskRecord>): Promise<TaskRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TaskRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TaskRecord>>
}

export function createInMemoryTaskRepository(seed: TaskRecord[] = []): TaskRepository {
  const rows = new Map(seed.map((record) => [record.id, taskRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): TaskRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Task organization mismatch')
      }

      const parsed = taskRecordSchema.parse(record)
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

      const next = taskRecordSchema.parse({
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
        searchableFields: ['title', 'description', 'priority'],
        filterableFields: [
          'id',
          'organization_id',
          'title',
          'due_date',
          'priority',
          'is_completed',
          'completed_at',
          'contact_id',
          'deal_id',
          'company_id',
          'assigned_to_user_id',
        ],
        defaultSort: [
          { field: 'due_date', direction: 'asc' },
          { field: 'created_at', direction: 'desc' },
        ],
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: ['title', 'description', 'priority'],
        filterableFields: [
          'id',
          'organization_id',
          'title',
          'due_date',
          'priority',
          'is_completed',
          'completed_at',
          'contact_id',
          'deal_id',
          'company_id',
          'assigned_to_user_id',
        ],
        defaultSort: [
          { field: 'due_date', direction: 'asc' },
          { field: 'created_at', direction: 'desc' },
        ],
      })
    },
  }
}

export function createSqliteTaskRepository(adapter: StorageAdapter): TaskRepository {
  return createTenantSqliteRepository<TaskRecord>(adapter, {
    tableName: 'tasks',
    columns: [
      'id',
      'organization_id',
      'title',
      'description',
      'due_date',
      'priority',
      'is_completed',
      'completed_at',
      'contact_id',
      'deal_id',
      'company_id',
      'assigned_to_user_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['title', 'description', 'priority'],
    filterableFields: [
      'id',
      'organization_id',
      'title',
      'due_date',
      'priority',
      'is_completed',
      'completed_at',
      'contact_id',
      'deal_id',
      'company_id',
      'assigned_to_user_id',
    ],
    defaultSort: [
      { field: 'due_date', direction: 'asc' },
      { field: 'created_at', direction: 'desc' },
    ],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        title: record.title,
        description: record.description ?? null,
        due_date: toSqliteDate(record.dueDate),
        priority: record.priority,
        is_completed: toSqliteBoolean(record.isCompleted),
        completed_at: toSqliteDate(record.completedAt),
        contact_id: record.contactId ?? null,
        deal_id: record.dealId ?? null,
        company_id: record.companyId ?? null,
        assigned_to_user_id: record.assignedToUserId ?? null,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return taskRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        title: row.title,
        description: row.description ?? null,
        dueDate: fromSqliteDate(row.due_date),
        priority: row.priority,
        isCompleted: fromSqliteBoolean(row.is_completed),
        completedAt: fromSqliteDate(row.completed_at),
        contactId: row.contact_id ?? null,
        dealId: row.deal_id ?? null,
        companyId: row.company_id ?? null,
        assignedToUserId: row.assigned_to_user_id ?? null,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresTaskRepository(adapter: StorageAdapter): TaskRepository {
  return createTenantPostgresRepository<TaskRecord>(adapter, {
    tableName: 'tasks',
    columns: [
      'id',
      'organization_id',
      'title',
      'description',
      'due_date',
      'priority',
      'is_completed',
      'completed_at',
      'contact_id',
      'deal_id',
      'company_id',
      'assigned_to_user_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['title', 'description', 'priority'],
    filterableFields: [
      'id',
      'organization_id',
      'title',
      'due_date',
      'priority',
      'is_completed',
      'completed_at',
      'contact_id',
      'deal_id',
      'company_id',
      'assigned_to_user_id',
    ],
    defaultSort: [
      { field: 'due_date', direction: 'asc' },
      { field: 'created_at', direction: 'desc' },
    ],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        title: record.title,
        description: record.description ?? null,
        due_date: record.dueDate,
        priority: record.priority,
        is_completed: record.isCompleted,
        completed_at: record.completedAt,
        contact_id: record.contactId ?? null,
        deal_id: record.dealId ?? null,
        company_id: record.companyId ?? null,
        assigned_to_user_id: record.assignedToUserId ?? null,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return taskRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        title: row.title,
        description: row.description ?? null,
        dueDate: fromPostgresDate(row.due_date),
        priority: row.priority,
        isCompleted: fromPostgresBoolean(row.is_completed),
        completedAt: fromPostgresDate(row.completed_at),
        contactId: row.contact_id ?? null,
        dealId: row.deal_id ?? null,
        companyId: row.company_id ?? null,
        assignedToUserId: row.assigned_to_user_id ?? null,
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
