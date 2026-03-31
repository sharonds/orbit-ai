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
