import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export class TagResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/tags')
  }

  async attach(id: string, body: Record<string, unknown>): Promise<any> {
    const response = await this.transport.request({
      method: 'POST',
      path: `${this.basePath}/${id}/attach`,
      body,
    })
    return response.data
  }

  async detach(id: string, body: Record<string, unknown>): Promise<any> {
    const response = await this.transport.request({
      method: 'POST',
      path: `${this.basePath}/${id}/detach`,
      body,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      attach: (id: string, body: Record<string, unknown>) =>
        this.transport.rawRequest({
          method: 'POST',
          path: `${this.basePath}/${id}/attach`,
          body,
        }),
      detach: (id: string, body: Record<string, unknown>) =>
        this.transport.rawRequest({
          method: 'POST',
          path: `${this.basePath}/${id}/detach`,
          body,
        }),
    }
  }
}
