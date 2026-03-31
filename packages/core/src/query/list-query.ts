import type { ListQuery, SearchQuery, SortSpec } from '../types/api.js'

export const DEFAULT_LIST_LIMIT = 50
export const MAX_LIST_LIMIT = 100
export const DEFAULT_CREATED_AT_SORT: SortSpec[] = [{ field: 'created_at', direction: 'desc' }]
export const SORT_TIEBREAKER_FIELD = 'id'

export interface NormalizedListQuery {
  limit: number
  cursor: string | null
  include: string[]
  filter: Record<string, unknown>
  sort: SortSpec[]
}

export interface NormalizedSearchQuery extends NormalizedListQuery {
  query?: string
}

export function normalizeSort(sort: SortSpec[] | undefined, defaultSort: SortSpec[] = DEFAULT_CREATED_AT_SORT): SortSpec[] {
  const normalizedBase = (sort && sort.length > 0 ? sort : defaultSort).map((entry) => ({
    field: entry.field.trim(),
    direction: entry.direction,
  }))

  const deduped = normalizedBase.filter(
    (entry, index, all) =>
      entry.field.length > 0 && all.findIndex((candidate) => candidate.field === entry.field) === index,
  )

  if (deduped.length === 0) {
    deduped.push(...DEFAULT_CREATED_AT_SORT)
  }

  if (!deduped.some((entry) => entry.field === SORT_TIEBREAKER_FIELD)) {
    deduped.push({
      field: SORT_TIEBREAKER_FIELD,
      direction: deduped[deduped.length - 1]?.direction ?? 'asc',
    })
  }

  return deduped
}

export function normalizeListQuery(
  query: ListQuery = {},
  options?: {
    defaultLimit?: number
    maxLimit?: number
    defaultSort?: SortSpec[]
  },
): NormalizedListQuery {
  const defaultLimit = options?.defaultLimit ?? DEFAULT_LIST_LIMIT
  const maxLimit = options?.maxLimit ?? MAX_LIST_LIMIT
  const requestedLimit = query.limit ?? defaultLimit
  const limit = Math.min(Math.max(requestedLimit, 1), maxLimit)

  return {
    limit,
    cursor: query.cursor ?? null,
    include: Array.from(new Set(query.include ?? [])),
    filter: query.filter ?? {},
    sort: normalizeSort(query.sort, options?.defaultSort),
  }
}

export function normalizeSearchQuery(
  query: SearchQuery = {},
  options?: Parameters<typeof normalizeListQuery>[1],
): NormalizedSearchQuery {
  const normalized = normalizeListQuery(query, options)
  const trimmedQuery = query.query?.trim()
  const normalizedQuery = trimmedQuery && trimmedQuery.length > 0 ? trimmedQuery : undefined

  return {
    ...normalized,
    ...(normalizedQuery ? { query: normalizedQuery } : {}),
  }
}
