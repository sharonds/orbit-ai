import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface TagRecord {
  id: string
  object: 'tag'
  organization_id: string
  name: string
  color: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTagInput {
  name: string
  color?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateTagInput extends Partial<CreateTagInput> {}

export class TagResource extends BaseResource<TagRecord, CreateTagInput, UpdateTagInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/tags')
  }

  async attach(id: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport.request({
      method: 'POST',
      path: `${this.basePath}/${id}/attach`,
      body,
    })
    return response.data
  }

  async detach(id: string, body: Record<string, unknown>): Promise<unknown> {
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
