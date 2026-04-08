import type { ListQuery, OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

export class BaseResource<TRecord, TCreate, TUpdate> {
  constructor(
    protected readonly transport: OrbitTransport,
    protected readonly basePath: string,
  ) {}

  async create(input: TCreate): Promise<TRecord> {
    const response = await this.transport.request<TRecord>({
      method: 'POST',
      path: this.basePath,
      body: input,
    })
    return response.data
  }

  async get(id: string, include?: string[]): Promise<TRecord> {
    const response = await this.transport.request<TRecord>({
      method: 'GET',
      path: `${this.basePath}/${id}`,
      ...(include?.length ? { query: { include: include.join(',') } } : {}),
    })
    return response.data
  }

  async update(id: string, input: TUpdate): Promise<TRecord> {
    const response = await this.transport.request<TRecord>({
      method: 'PATCH',
      path: `${this.basePath}/${id}`,
      body: input,
    })
    return response.data
  }

  async delete(id: string): Promise<{ id: string; deleted: true }> {
    const response = await this.transport.request<{ id: string; deleted: true }>({
      method: 'DELETE',
      path: `${this.basePath}/${id}`,
    })
    return response.data
  }

  /**
   * Fetch the first page of results. Returns a Promise of the full envelope
   * (data, meta, links). This is the default for most use cases.
   *
   * For multi-page iteration or cursor control, use `.pages()` to get an
   * `AutoPager` with `.firstPage()` and `.autoPaginate()` helpers.
   */
  async list(query: ListQuery = {}): Promise<OrbitEnvelope<TRecord[]>> {
    return new AutoPager<TRecord>(this.transport, this.basePath, query).firstPage()
  }

  /**
   * Get an AutoPager for cursor-based multi-page iteration.
   *
   * ```ts
   * for await (const row of client.contacts.pages({ limit: 50 }).autoPaginate()) {
   *   console.log(row.id)
   * }
   * ```
   */
  pages(query: ListQuery = {}): AutoPager<TRecord> {
    return new AutoPager<TRecord>(this.transport, this.basePath, query)
  }

  async search(body: Record<string, unknown>): Promise<TRecord[]> {
    const response = await this.transport.request<TRecord[]>({
      method: 'POST',
      path: `${this.basePath}/search`,
      body,
    })
    return response.data
  }

  async batch(body: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport.request<unknown>({
      method: 'POST',
      path: `${this.basePath}/batch`,
      body,
    })
    return response.data
  }

  response() {
    return {
      create: (input: TCreate) =>
        this.transport.rawRequest<TRecord>({
          method: 'POST',
          path: this.basePath,
          body: input,
        }),
      get: (id: string, include?: string[]) =>
        this.transport.rawRequest<TRecord>({
          method: 'GET',
          path: `${this.basePath}/${id}`,
          ...(include?.length ? { query: { include: include.join(',') } } : {}),
        }),
      list: (query: ListQuery = {}) =>
        this.transport.rawRequest<TRecord[]>({
          method: 'GET',
          path: this.basePath,
          query: query as unknown as Record<string, unknown>,
        }),
      update: (id: string, input: TUpdate) =>
        this.transport.rawRequest<TRecord>({
          method: 'PATCH',
          path: `${this.basePath}/${id}`,
          body: input,
        }),
      delete: (id: string) =>
        this.transport.rawRequest<{ id: string; deleted: true }>({
          method: 'DELETE',
          path: `${this.basePath}/${id}`,
        }),
      search: (body: Record<string, unknown>) =>
        this.transport.rawRequest<TRecord[]>({
          method: 'POST',
          path: `${this.basePath}/search`,
          body,
        }),
      batch: (body: Record<string, unknown>) =>
        this.transport.rawRequest<unknown>({
          method: 'POST',
          path: `${this.basePath}/batch`,
          body,
        }),
    }
  }
}
