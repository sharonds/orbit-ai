import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export class SequenceResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/sequences')
  }

  async enroll(id: string, body: Record<string, unknown>): Promise<any> {
    const response = await this.transport.request({
      method: 'POST',
      path: `${this.basePath}/${id}/enroll`,
      body,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      enroll: (id: string, body: Record<string, unknown>) =>
        this.transport.rawRequest({
          method: 'POST',
          path: `${this.basePath}/${id}/enroll`,
          body,
        }),
    }
  }
}
