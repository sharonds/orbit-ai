import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface ContactRecord {
  id: string
  object: 'contact'
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  source_channel: string | null
  status: string
  company_id: string | null
  assigned_to_user_id: string | null
  lead_score: number
  is_hot: boolean
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateContactInput {
  name: string
  email?: string
  phone?: string
  title?: string
  source_channel?: string
  status?: string
  company_id?: string
  assigned_to_user_id?: string
  lead_score?: number
  is_hot?: boolean
  custom_fields?: Record<string, unknown>
}

export interface UpdateContactInput extends Partial<CreateContactInput> {}

export class ContactResource extends BaseResource<ContactRecord, CreateContactInput, UpdateContactInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/contacts')
  }

  async context(idOrEmail: string) {
    const response = await this.transport.request<Record<string, unknown>>({
      method: 'GET',
      path: `/v1/context/${idOrEmail}`,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      context: (idOrEmail: string) =>
        this.transport.rawRequest<Record<string, unknown>>({
          method: 'GET',
          path: `/v1/context/${idOrEmail}`,
        }),
    }
  }
}
