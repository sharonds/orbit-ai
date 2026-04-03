import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export class ActivityResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/activities')
  }

  async log(body: Record<string, unknown>): Promise<any> {
    const response = await this.transport.request({
      method: 'POST',
      path: `${this.basePath}/log`,
      body,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      log: (body: Record<string, unknown>) =>
        this.transport.rawRequest({
          method: 'POST',
          path: `${this.basePath}/log`,
          body,
        }),
    }
  }
}
