import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface SequenceRecord {
  id: string
  object: 'sequence'
  organization_id: string
  name: string
  description: string | null
  status: string
  trigger_type: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateSequenceInput {
  name: string
  description?: string
  status?: string
  trigger_type?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateSequenceInput extends Partial<CreateSequenceInput> {}

export class SequenceResource extends BaseResource<SequenceRecord, CreateSequenceInput, UpdateSequenceInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/sequences')
  }

  async enroll(id: string, body: Record<string, unknown>): Promise<unknown> {
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
