import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

export class WebhookResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/webhooks')
  }

  deliveries(webhookId: string): AutoPager<any> {
    return new AutoPager(this.transport, `/v1/webhooks/${webhookId}/deliveries`, {})
  }

  async redeliver(webhookId: string) {
    const r = await this.transport.request({ method: 'POST', path: `/v1/webhooks/${webhookId}/redeliver` })
    return r.data
  }

  response() {
    return {
      ...super.response(),
      deliveries: (webhookId: string) =>
        this.transport.rawRequest({ method: 'GET', path: `/v1/webhooks/${webhookId}/deliveries` }),
      redeliver: (webhookId: string) =>
        this.transport.rawRequest({ method: 'POST', path: `/v1/webhooks/${webhookId}/redeliver` }),
    }
  }
}
