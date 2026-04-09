import type { ListQuery } from '@orbit-ai/core'
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

  list(query: ListQuery = {}): AutoPager<TRecord> {
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
