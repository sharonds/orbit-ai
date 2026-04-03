import type { OrbitEnvelope, ListQuery } from '@orbit-ai/core'
import type { OrbitTransport } from './transport/index.js'

function serializeListQuery(query: ListQuery): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (query.limit !== undefined) result['limit'] = query.limit
  if (query.cursor) result['cursor'] = query.cursor
  if (query.include?.length) result['include'] = query.include.join(',')
  return result
}

export class AutoPager<T> {
  constructor(
    private readonly transport: OrbitTransport,
    private readonly path: string,
    private readonly initialQuery: ListQuery,
  ) {}

  async firstPage(): Promise<OrbitEnvelope<T[]>> {
    return this.transport.request<T[]>({
      method: 'GET',
      path: this.path,
      query: serializeListQuery(this.initialQuery),
    })
  }

  async *autoPaginate(): AsyncGenerator<T, void, undefined> {
    let cursor: string | undefined = this.initialQuery.cursor
    for (;;) {
      const query: ListQuery = { ...this.initialQuery }
      if (cursor !== undefined) {
        query.cursor = cursor
      }
      const page = await this.transport.request<T[]>({
        method: 'GET',
        path: this.path,
        query: serializeListQuery(query),
      })
      for (const row of page.data) yield row
      if (!page.meta.has_more || !page.meta.next_cursor) return
      cursor = page.meta.next_cursor
    }
  }
}
