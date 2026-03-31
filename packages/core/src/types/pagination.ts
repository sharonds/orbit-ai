export interface CursorPage {
  limit?: number
  cursor?: string
}

export interface PageMeta {
  request_id: string
  cursor: string | null
  next_cursor: string | null
  has_more: boolean
  version: string
}

export interface EnvelopeLinks {
  self: string
  next?: string
}

export interface OrbitEnvelope<T> {
  data: T
  meta: PageMeta
  links: EnvelopeLinks
}

export interface InternalPaginatedResult<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export function toWirePageMeta(input: {
  requestId: string
  version: string
  page: InternalPaginatedResult<unknown>
}): PageMeta {
  return {
    request_id: input.requestId,
    cursor: null,
    next_cursor: input.page.nextCursor,
    has_more: input.page.hasMore,
    version: input.version,
  }
}
