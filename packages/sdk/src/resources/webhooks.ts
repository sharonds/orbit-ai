import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

export interface WebhookRecord {
  id: string
  object: 'webhook'
  organization_id: string
  url: string
  events: string[]
  status: string
  description: string | null
  signing_secret_last_four: string | null
  signing_secret_created_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateWebhookInput {
  url: string
  events: string[]
  status?: string
  description?: string
}

export interface UpdateWebhookInput extends Partial<CreateWebhookInput> {}

export class WebhookResource extends BaseResource<WebhookRecord, CreateWebhookInput, UpdateWebhookInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/webhooks')
  }

  deliveries(webhookId: string): AutoPager<unknown> {
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
