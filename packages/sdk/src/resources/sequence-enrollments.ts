import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export class SequenceEnrollmentResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/sequence_enrollments')
  }

  async unenroll(id: string): Promise<any> {
    const response = await this.transport.request({
      method: 'POST',
      path: `${this.basePath}/${id}/unenroll`,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      unenroll: (id: string) =>
        this.transport.rawRequest({
          method: 'POST',
          path: `${this.basePath}/${id}/unenroll`,
        }),
    }
  }
}
