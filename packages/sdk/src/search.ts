import type { OrbitTransport } from './transport/index.js'

export interface SearchInput {
  query: string
  object_types?: string[]
  limit?: number
  cursor?: string
}

export class SearchResource {
  constructor(private readonly transport: OrbitTransport) {}

  async query(input: SearchInput) {
    const response = await this.transport.request<unknown>({
      method: 'POST',
      path: '/v1/search',
      body: input,
    })
    return response.data
  }

  response() {
    return {
      query: (input: SearchInput) =>
        this.transport.rawRequest<unknown>({
          method: 'POST',
          path: '/v1/search',
          body: input,
        }),
    }
  }
}
