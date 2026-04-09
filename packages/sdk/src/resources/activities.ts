import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface ActivityRecord {
  id: string
  object: 'activity'
  organization_id: string
  type: string
  subject: string | null
  description: string | null
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  user_id: string | null
  occurred_at: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateActivityInput {
  type: string
  subject?: string
  description?: string
  contact_id?: string
  company_id?: string
  deal_id?: string
  user_id?: string
  occurred_at?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateActivityInput extends Partial<CreateActivityInput> {}

export class ActivityResource extends BaseResource<ActivityRecord, CreateActivityInput, UpdateActivityInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/activities')
  }

  async log(body: CreateActivityInput): Promise<ActivityRecord> {
    const response = await this.transport.request<ActivityRecord>({
      method: 'POST',
      path: `${this.basePath}/log`,
      body,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      log: (body: CreateActivityInput) =>
        this.transport.rawRequest<ActivityRecord>({
          method: 'POST',
          path: `${this.basePath}/log`,
          body,
        }),
    }
  }
}
