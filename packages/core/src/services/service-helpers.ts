import { createCursorPayload, decodeCursor, encodeCursor } from '../query/cursor.js'
import { assertOrbitId } from '../ids/parse-id.js'
import { normalizeSearchQuery } from '../query/list-query.js'
import { createOrbitError } from '../types/errors.js'
import type { SearchQuery, SortSpec } from '../types/api.js'
import type { InternalPaginatedResult } from '../types/pagination.js'
import type { OrbitAuthContext } from '../adapters/interface.js'

type ComparableValue = string | number | boolean | null

const BLOCKED_FILTER_FIELDS = new Set([
  'externalAuthId',
  'external_auth_id',
  'keyHash',
  'key_hash',
  'keyPrefix',
  'key_prefix',
])

function toRecordKey(field: string): string {
  return field.includes('_')
    ? field.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
    : field
}

function toQueryKey(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()
}

function normalizeComparable(value: unknown): ComparableValue {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return JSON.stringify(value)
}

function getFieldValue(record: Record<string, unknown>, field: string): ComparableValue {
  return normalizeComparable(record[field] ?? record[toRecordKey(field)])
}

function compareValues(left: ComparableValue, right: ComparableValue): number {
  if (left === right) {
    return 0
  }

  if (left === null) {
    return 1
  }

  if (right === null) {
    return -1
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right))
}

function sortRecords<T extends Record<string, unknown>>(records: T[], sort: SortSpec[]): T[] {
  return [...records].sort((left, right) => {
    for (const rule of sort) {
      const comparison = compareValues(getFieldValue(left, rule.field), getFieldValue(right, rule.field))

      if (comparison !== 0) {
        return rule.direction === 'asc' ? comparison : -comparison
      }
    }

    return 0
  })
}

function applyFilter<T extends Record<string, unknown>>(records: T[], filter: Record<string, unknown>): T[] {
  const entries = Object.entries(filter)

  if (entries.length === 0) {
    return records
  }

  return records.filter((record) =>
    entries.every(([field, expected]) => getFieldValue(record, field) === normalizeComparable(expected)),
  )
}

function buildFilterableFields<T extends Record<string, unknown>>(
  records: T[],
  explicitFilterableFields: string[] | undefined,
): Set<string> {
  const sourceFields = explicitFilterableFields ?? Array.from(new Set(records.flatMap((record) => Object.keys(record))))
  const allowed = new Set<string>()

  for (const field of sourceFields) {
    const trimmed = field.trim()
    if (trimmed.length === 0) {
      continue
    }

    for (const candidate of [trimmed, toRecordKey(trimmed), toQueryKey(trimmed)]) {
      if (!BLOCKED_FILTER_FIELDS.has(candidate)) {
        allowed.add(candidate)
      }
    }
  }

  return allowed
}

function applySearch<T extends Record<string, unknown>>(records: T[], query: string | undefined, fields: string[]): T[] {
  if (!query) {
    return records
  }

  const needle = query.toLowerCase()
  return records.filter((record) =>
    fields.some((field) => {
      const value = getFieldValue(record, field)
      return value !== null && String(value).toLowerCase().includes(needle)
    }),
  )
}

export function runArrayQuery<T extends { id: string } & Record<string, unknown>>(
  records: T[],
  query: SearchQuery,
  options: {
    searchableFields: string[]
    filterableFields?: string[]
    defaultSort?: SortSpec[]
  },
): InternalPaginatedResult<T> {
  const normalized = normalizeSearchQuery(query, {
    ...(options.defaultSort ? { defaultSort: options.defaultSort } : {}),
  })
  const filterableFields = buildFilterableFields(records, options.filterableFields)
  const filter = Object.fromEntries(
    Object.entries(normalized.filter).filter(([field]) => {
      const normalizedField = field.trim()
      return (
        filterableFields.has(normalizedField) ||
        filterableFields.has(toRecordKey(normalizedField)) ||
        filterableFields.has(toQueryKey(normalizedField))
      )
    }),
  )

  let result = applyFilter(records, filter)
  result = applySearch(result, normalized.query, options.searchableFields)
  result = sortRecords(result, normalized.sort)

  let startIndex = 0
  if (normalized.cursor) {
    const cursor = decodeCursor(normalized.cursor)
    const cursorIndex = result.findIndex((record) => record.id === cursor.id)

    if (cursorIndex < 0) {
      throw createOrbitError({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      })
    }

    startIndex = cursorIndex + 1
  }

  const page = result.slice(startIndex, startIndex + normalized.limit + 1)
  const hasMore = page.length > normalized.limit
  const data = hasMore ? page.slice(0, normalized.limit) : page
  const lastRecord = data.at(-1)

  return {
    data,
    hasMore,
    nextCursor:
      hasMore && lastRecord
        ? encodeCursor(
            createCursorPayload({
              id: lastRecord.id,
              sort: normalized.sort,
              values: Object.fromEntries(
                normalized.sort.map((entry) => [entry.field, getFieldValue(lastRecord, entry.field)]),
              ),
            }),
          )
        : null,
  }
}

export function assertFound<T>(value: T | null, message: string): T {
  if (value === null) {
    throw createOrbitError({
      code: 'RESOURCE_NOT_FOUND',
      message,
    })
  }

  return value
}

export function assertDeleted(value: boolean, message: string): void {
  if (!value) {
    throw createOrbitError({
      code: 'RESOURCE_NOT_FOUND',
      message,
    })
  }
}

export function assertOrgContext(ctx: Pick<OrbitAuthContext, 'orgId'>): string {
  return assertOrbitId(ctx.orgId, 'organization')
}
