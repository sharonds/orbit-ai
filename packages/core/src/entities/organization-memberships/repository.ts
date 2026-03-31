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
