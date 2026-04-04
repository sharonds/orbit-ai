export type SortDirection = 'asc' | 'desc'

export interface SortSpec {
  field: string
  direction: SortDirection
}

export interface ListQuery {
  limit?: number
  cursor?: string
  include?: string[]
  sort?: SortSpec[]
  filter?: Record<string, unknown>
}

export interface SearchQuery extends ListQuery {
  query?: string
  object_types?: string[]
}
