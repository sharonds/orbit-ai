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
import { createOrbitError } from '../types/errors.js'
import type { InternalPaginatedResult } from '../types/pagination.js'

/**
 * L11: Hard cap on the number of rows we will pull into memory per entity
 * type when assembling a merged search response. The merged-search code
 * path uses `fetchAllPages` to flatten every page into a single array
 * before sorting/slicing, which is OOM-prone on large tenants.
 *
 * This is an INTERIM safety net — T10's registry-driven search rebuild
 * is expected to push pagination down to the repositories and eliminate
 * the need for `fetchAllPages` entirely. When that lands, this cap and
 * its test should be removed in the same commit so we don't leave
 * dead defensive code.
 */
export const MAX_SEARCH_ROWS_PER_TYPE = 5000

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

      // L11 OOM cap: refuse the request loudly once we hit
      // MAX_SEARCH_ROWS_PER_TYPE. Originally this returned a truncated
      // result with a console.warn, but the Phase 2 silent-failure-hunter
      // gate flagged that as a real risk: the API would respond with
      // hasMore: false on a truncated dataset, leaving the caller no way
      // to detect the truncation. Throwing forces the caller to refine
      // the query (filters, narrower object_types) instead of unknowingly
      // operating on incomplete data.
      if (rows.length >= MAX_SEARCH_ROWS_PER_TYPE && cursor !== null) {
        throw createOrbitError({
          code: 'SEARCH_RESULT_TOO_LARGE',
          message:
            `Search would return more than ${MAX_SEARCH_ROWS_PER_TYPE} rows for a single ` +
            `entity type. Narrow the query with filters or restrict object_types.`,
        })
      }
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

      // Strip both `object_types` and `query` before passing to runArrayQuery.
      // - `object_types` is not a ListQuery field (M5 fix from a prior wave).
      // - `query` is the free-text search term, which the per-entity repos
      //   already applied via their own `search()` implementations. Leaving
      //   it in here would re-run text search against the merged result's
      //   reduced surface (only `title`/`subtitle` are searchable at this
      //   layer), silently dropping results whose match was on a field that
      //   only the underlying entity repo knew about (e.g. company.industry,
      //   contact.email). M1 fix.
      const { object_types: _ot, query: _q, ...listQuery } = query
      return runArrayQuery(rows, listQuery, {
        searchableFields: ['title', 'subtitle'],
        // M2 fix: emitted records use camelCase `updatedAt` (see
        // SearchResultRecord above). The sort field must match the emitted
        // shape — the previous snake_case `updated_at` only worked by
        // accident through `toRecordKey` conversion in the helper.
        defaultSort: [{ field: 'updatedAt', direction: 'desc' }],
      })
    },
  }
}
