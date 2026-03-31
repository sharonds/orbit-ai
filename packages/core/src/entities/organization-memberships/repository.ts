import type { StorageAdapter } from '../../adapters/interface.js'
import { createBootstrapSqliteRepository, fromSqliteDate, toSqliteDate } from '../../repositories/sqlite/shared.js'
import { runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { organizationMembershipRecordSchema, type OrganizationMembershipRecord } from './validators.js'

export interface OrganizationMembershipRepository {
  create(record: OrganizationMembershipRecord): Promise<OrganizationMembershipRecord>
  get(id: string): Promise<OrganizationMembershipRecord | null>
  list(query: SearchQuery): Promise<InternalPaginatedResult<OrganizationMembershipRecord>>
}

export function createInMemoryOrganizationMembershipRepository(
  seed: OrganizationMembershipRecord[] = [],
): OrganizationMembershipRepository {
  const rows = new Map(seed.map((record) => [record.id, organizationMembershipRecordSchema.parse(record)]))

  return {
    async create(record) {
      const parsed = organizationMembershipRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(id) {
      return rows.get(id) ?? null
    },
    async list(query) {
      return runArrayQuery([...rows.values()], query, {
        searchableFields: ['role'],
        defaultSort: [{ field: 'created_at', direction: 'desc' }],
      })
    },
  }
}

export function createSqliteOrganizationMembershipRepository(
  adapter: StorageAdapter,
): OrganizationMembershipRepository {
  return createBootstrapSqliteRepository<OrganizationMembershipRecord>(adapter, {
    tableName: 'organization_memberships',
    columns: [
      'id',
      'organization_id',
      'user_id',
      'role',
      'invited_by_user_id',
      'joined_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['role'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        user_id: record.userId,
        role: record.role,
        invited_by_user_id: record.invitedByUserId ?? null,
        joined_at: toSqliteDate(record.joinedAt),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return organizationMembershipRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        role: row.role,
        invitedByUserId: row.invited_by_user_id ?? null,
        joinedAt: fromSqliteDate(row.joined_at),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}
