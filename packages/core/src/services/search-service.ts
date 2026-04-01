import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CompanyRepository } from '../entities/companies/repository.js'
import type { ContactRepository } from '../entities/contacts/repository.js'
import type { DealRepository } from '../entities/deals/repository.js'
import type { PipelineRepository } from '../entities/pipelines/repository.js'
import type { StageRepository } from '../entities/stages/repository.js'
import type { UserRepository } from '../entities/users/repository.js'
import { runArrayQuery } from './service-helpers.js'
import type { SearchQuery } from '../types/api.js'
import type { InternalPaginatedResult } from '../types/pagination.js'

export interface SearchResultRecord extends Record<string, unknown> {
  objectType: 'company' | 'contact' | 'deal' | 'pipeline' | 'stage' | 'user'
  id: string
  title: string
  subtitle: string | null
  record: Record<string, unknown>
  updatedAt: string
}

export interface SearchService {
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SearchResultRecord>>
}

export function createSearchService(deps: {
  companies: CompanyRepository
  contacts: ContactRepository
  deals: DealRepository
  pipelines: PipelineRepository
  stages: StageRepository
  users: UserRepository
}): SearchService {
  return {
    async search(ctx, query) {
      const { cursor: _cursor, ...queryWithoutCursor } = query
      const expandedQuery: SearchQuery = {
        ...queryWithoutCursor,
        limit: 100,
      }

      const [companies, contacts, deals, pipelines, stages, users] = await Promise.all([
        deps.companies.search(ctx, expandedQuery),
        deps.contacts.search(ctx, expandedQuery),
        deps.deals.search(ctx, expandedQuery),
        deps.pipelines.search(ctx, expandedQuery),
        deps.stages.search(ctx, expandedQuery),
        deps.users.search(ctx, expandedQuery),
      ])

      const rows: SearchResultRecord[] = [
        ...companies.data.map((record) => ({
          objectType: 'company' as const,
          id: record.id,
          title: record.name,
          subtitle: record.domain ?? record.industry ?? null,
          record,
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...contacts.data.map((record) => ({
          objectType: 'contact' as const,
          id: record.id,
          title: record.name,
          subtitle: record.email ?? record.title ?? null,
          record,
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...deals.data.map((record) => ({
          objectType: 'deal' as const,
          id: record.id,
          title: record.title,
          subtitle: record.status,
          record,
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...pipelines.data.map((record) => ({
          objectType: 'pipeline' as const,
          id: record.id,
          title: record.name,
          subtitle: record.description ?? null,
          record,
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...stages.data.map((record) => ({
          objectType: 'stage' as const,
          id: record.id,
          title: record.name,
          subtitle: record.color ?? null,
          record,
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...users.data.map((record) => ({
          objectType: 'user' as const,
          id: record.id,
          title: record.name,
          subtitle: record.email,
          record,
          updatedAt: record.updatedAt.toISOString(),
        })),
      ]

      return runArrayQuery(rows, query, {
        searchableFields: ['object_type', 'title', 'subtitle'],
        defaultSort: [{ field: 'updated_at', direction: 'desc' }],
      })
    },
  }
}
