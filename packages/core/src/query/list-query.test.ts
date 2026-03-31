import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CREATED_AT_SORT,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  SORT_TIEBREAKER_FIELD,
  normalizeListQuery,
  normalizeSearchQuery,
  normalizeSort,
} from './list-query.js'

describe('list query helpers', () => {
  it('applies the default limit and deterministic default sort', () => {
    const normalized = normalizeListQuery()

    expect(normalized.limit).toBe(DEFAULT_LIST_LIMIT)
    expect(normalized.sort).toEqual([
      ...DEFAULT_CREATED_AT_SORT,
      { field: SORT_TIEBREAKER_FIELD, direction: 'desc' },
    ])
  })

  it('caps requested limits at the maximum', () => {
    const normalized = normalizeListQuery({ limit: MAX_LIST_LIMIT + 50 })

    expect(normalized.limit).toBe(MAX_LIST_LIMIT)
  })

  it('deduplicates sort fields and appends the id tie-breaker', () => {
    expect(
      normalizeSort([
        { field: 'updated_at', direction: 'asc' },
        { field: 'updated_at', direction: 'desc' },
      ]),
    ).toEqual([
      { field: 'updated_at', direction: 'asc' },
      { field: 'id', direction: 'asc' },
    ])
  })

  it('trims empty search queries', () => {
    const normalized = normalizeSearchQuery({ query: '   ' })

    expect(normalized.query).toBeUndefined()
  })
})
