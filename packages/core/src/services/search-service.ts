import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CompanyRepository } from '../entities/companies/repository.js'
import type { ContactRepository } from '../entities/contacts/repository.js'
import type { DealRepository } from '../entities/deals/repository.js'
import type { PipelineRepository } from '../entities/pipelines/repository.js'
import type { StageRepository } from '../entities/stages/repository.js'
import type { UserRepository } from '../entities/users/repository.js'
import { runArrayQuery } from './service-helpers.js'
import { MAX_LIST_LIMIT } from '../query/list-query.js'
import type { SearchQuery } from '../types/api.js'
import type { InternalPaginatedResult } from '../types/pagination.js'

type SearchRecordSummary = Record<string, string | number | boolean | null>

export interface SearchResultRecord extends Record<string, unknown> {
  objectType: 'company' | 'contact' | 'deal' | 'pipeline' | 'stage' | 'user'
  id: string
  title: string
  subtitle: string | null
  record: SearchRecordSummary
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
  async function fetchAllPages<TRecord>(
    search: (query: SearchQuery) => Promise<InternalPaginatedResult<TRecord>>,
    query: SearchQuery,
  ): Promise<TRecord[]> {
    const rows: TRecord[] = []
    let cursor: string | null = null

    do {
      const page = await search({
        ...query,
        ...(cursor !== null ? { cursor } : {}),
        limit: MAX_LIST_LIMIT,
      })

      rows.push(...page.data)
      cursor = page.hasMore ? page.nextCursor : null
    } while (cursor)

    return rows
  }

  function summarizeCompany(record: Awaited<ReturnType<CompanyRepository['search']>>['data'][number]): SearchRecordSummary {
    return {
      id: record.id,
      name: record.name,
      domain: record.domain ?? null,
      industry: record.industry ?? null,
      website: record.website ?? null,
    }
  }

  function summarizeContact(record: Awaited<ReturnType<ContactRepository['search']>>['data'][number]): SearchRecordSummary {
    return {
      id: record.id,
      name: record.name,
      email: record.email ?? null,
      title: record.title ?? null,
      status: record.status,
      companyId: record.companyId ?? null,
    }
  }

  function summarizeDeal(record: Awaited<ReturnType<DealRepository['search']>>['data'][number]): SearchRecordSummary {
    return {
      id: record.id,
      title: record.title,
      status: record.status,
      currency: record.currency,
      value: record.value ?? null,
      stageId: record.stageId ?? null,
      pipelineId: record.pipelineId ?? null,
      contactId: record.contactId ?? null,
      companyId: record.companyId ?? null,
    }
  }

  function summarizePipeline(record: Awaited<ReturnType<PipelineRepository['search']>>['data'][number]): SearchRecordSummary {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? null,
      isDefault: record.isDefault,
    }
  }

  function summarizeStage(record: Awaited<ReturnType<StageRepository['search']>>['data'][number]): SearchRecordSummary {
    return {
      id: record.id,
      name: record.name,
      pipelineId: record.pipelineId,
      stageOrder: record.stageOrder,
      probability: record.probability,
      color: record.color ?? null,
      isWon: record.isWon,
      isLost: record.isLost,
    }
  }

  function summarizeUser(record: Awaited<ReturnType<UserRepository['search']>>['data'][number]): SearchRecordSummary {
    return {
      id: record.id,
      name: record.name,
      email: record.email ?? null,
      role: record.role,
      isActive: record.isActive,
    }
  }

  const PLURAL_TO_SINGULAR: Record<string, SearchResultRecord['objectType']> = {
    contacts: 'contact',
    companies: 'company',
    deals: 'deal',
    pipelines: 'pipeline',
    stages: 'stage',
    users: 'user',
  }

  function shouldFetch(type: string, object_types: string[] | undefined): boolean {
    if (!object_types?.length) return true
    return object_types.includes(type)
  }

  return {
    async search(ctx, query) {
      const { cursor: _cursor, object_types, ...queryWithoutCursor } = query

      const [companies, contacts, deals, pipelines, stages, users] = await Promise.all([
        shouldFetch('companies', object_types)
          ? fetchAllPages((page) => deps.companies.search(ctx, page), queryWithoutCursor)
          : Promise.resolve([]),
        shouldFetch('contacts', object_types)
          ? fetchAllPages((page) => deps.contacts.search(ctx, page), queryWithoutCursor)
          : Promise.resolve([]),
        shouldFetch('deals', object_types)
          ? fetchAllPages((page) => deps.deals.search(ctx, page), queryWithoutCursor)
          : Promise.resolve([]),
        shouldFetch('pipelines', object_types)
          ? fetchAllPages((page) => deps.pipelines.search(ctx, page), queryWithoutCursor)
          : Promise.resolve([]),
        shouldFetch('stages', object_types)
          ? fetchAllPages((page) => deps.stages.search(ctx, page), queryWithoutCursor)
          : Promise.resolve([]),
        shouldFetch('users', object_types)
          ? fetchAllPages((page) => deps.users.search(ctx, page), queryWithoutCursor)
          : Promise.resolve([]),
      ])

      const rows: SearchResultRecord[] = [
        ...companies.map((record) => ({
          objectType: 'company' as const,
          id: record.id,
          title: record.name,
          subtitle: record.domain ?? record.industry ?? null,
          record: summarizeCompany(record),
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...contacts.map((record) => ({
          objectType: 'contact' as const,
          id: record.id,
          title: record.name,
          subtitle: record.email ?? record.title ?? null,
          record: summarizeContact(record),
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...deals.map((record) => ({
          objectType: 'deal' as const,
          id: record.id,
          title: record.title,
          subtitle: record.status ?? null,
          record: summarizeDeal(record),
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...pipelines.map((record) => ({
          objectType: 'pipeline' as const,
          id: record.id,
          title: record.name,
          subtitle: record.description ?? null,
          record: summarizePipeline(record),
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...stages.map((record) => ({
          objectType: 'stage' as const,
          id: record.id,
          title: record.name,
          subtitle: record.color ?? null,
          record: summarizeStage(record),
          updatedAt: record.updatedAt.toISOString(),
        })),
        ...users.map((record) => ({
          objectType: 'user' as const,
          id: record.id,
          title: record.name,
          subtitle: record.email ?? null,
          record: summarizeUser(record),
          updatedAt: record.updatedAt.toISOString(),
        })),
      ]

      // Strip object_types before passing to runArrayQuery — it's not a ListQuery field
      const { object_types: _ot, ...listQuery } = query
      return runArrayQuery(rows, listQuery, {
        searchableFields: ['title', 'subtitle'],
        defaultSort: [{ field: 'updated_at', direction: 'desc' }],
      })
    },
  }
}
