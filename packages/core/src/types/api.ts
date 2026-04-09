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

export const SEARCHABLE_OBJECT_TYPES = ['contacts', 'companies', 'deals', 'pipelines', 'stages', 'users'] as const
export type SearchableObjectType = (typeof SEARCHABLE_OBJECT_TYPES)[number]

export interface SearchQuery extends ListQuery {
  query?: string
  object_types?: SearchableObjectType[]
}
