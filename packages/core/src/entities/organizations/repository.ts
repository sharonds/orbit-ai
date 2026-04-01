import type { StorageAdapter } from '../../adapters/interface.js'
import { createBootstrapSqliteRepository, fromSqliteBoolean, fromSqliteDate, fromSqliteJson, toSqliteBoolean, toSqliteDate, toSqliteJson } from '../../repositories/sqlite/shared.js'
import { runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { organizationRecordSchema, type OrganizationRecord } from './validators.js'

export interface OrganizationRepository {
  create(record: OrganizationRecord): Promise<OrganizationRecord>
  get(id: string): Promise<OrganizationRecord | null>
  list(query: SearchQuery): Promise<InternalPaginatedResult<OrganizationRecord>>
}

export function createInMemoryOrganizationRepository(seed: OrganizationRecord[] = []): OrganizationRepository {
  const rows = new Map(seed.map((record) => [record.id, organizationRecordSchema.parse(record)]))

  return {
    async create(record) {
      const parsed = organizationRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(id) {
      return rows.get(id) ?? null
    },
    async list(query) {
      return runArrayQuery([...rows.values()], query, {
        searchableFields: ['name', 'slug', 'plan'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteOrganizationRepository(adapter: StorageAdapter): OrganizationRepository {
  return createBootstrapSqliteRepository<OrganizationRecord>(adapter, {
    tableName: 'organizations',
    columns: ['id', 'name', 'slug', 'plan', 'is_active', 'settings', 'created_at', 'updated_at'],
    searchableFields: ['name', 'slug', 'plan'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        name: record.name,
        slug: record.slug,
        plan: record.plan,
        is_active: toSqliteBoolean(record.isActive),
        settings: toSqliteJson(record.settings),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return organizationRecordSchema.parse({
        id: row.id,
        name: row.name,
        slug: row.slug,
        plan: row.plan,
        isActive: fromSqliteBoolean(row.is_active),
        settings: fromSqliteJson(row.settings, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}
