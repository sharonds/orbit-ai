import type { ListQuery } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

/**
 * SequenceEventResource is read-only — no create, update, or delete.
 */
export class SequenceEventResource {
  constructor(
    private readonly transport: OrbitTransport,
    private readonly basePath: string = '/v1/sequence_events',
  ) {}

  async get(id: string): Promise<any> {
    const response = await this.transport.request({
      method: 'GET',
      path: `${this.basePath}/${id}`,
    })
    return response.data
  }

  list(query: ListQuery = {}): AutoPager<any> {
    return new AutoPager(this.transport, this.basePath, query)
  }

  response() {
    return {
      get: (id: string) =>
        this.transport.rawRequest({
          method: 'GET',
          path: `${this.basePath}/${id}`,
        }),
    }
  }
}
