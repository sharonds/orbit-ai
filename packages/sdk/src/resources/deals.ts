import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export type DealValueInput = number | string | null

export interface DealRecord {
  id: string
  object: 'deal'
  organization_id: string
  name: string
  value: string | null
  currency: string | null
  stage_id: string | null
  pipeline_id: string | null
  contact_id: string | null
  company_id: string | null
  assigned_to_user_id: string | null
  expected_close_date: string | null
  status: string
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateDealInput {
  name: string
  value?: DealValueInput
  currency?: string
  stage_id?: string
  pipeline_id?: string
  contact_id?: string
  company_id?: string
  assigned_to_user_id?: string
  expected_close_date?: string
  status?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateDealInput extends Partial<CreateDealInput> {}

export class DealResource extends BaseResource<DealRecord, CreateDealInput, UpdateDealInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/deals')
  }

  async move(id: string, input: { stage_id: string }): Promise<DealRecord> {
    const response = await this.transport.request<DealRecord>({
      method: 'POST',
      path: `${this.basePath}/${id}/move`,
      body: input,
    })
    return response.data
  }

  async pipeline(query?: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport.request<unknown>({
      method: 'GET',
      path: `${this.basePath}/pipeline`,
      ...(query ? { query } : {}),
    })
    return response.data
  }

  async stats(query?: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport.request<unknown>({
      method: 'GET',
      path: `${this.basePath}/stats`,
      ...(query ? { query } : {}),
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      move: (id: string, input: { stage_id: string }) =>
        this.transport.rawRequest<DealRecord>({
          method: 'POST',
          path: `${this.basePath}/${id}/move`,
          body: input,
        }),
      pipeline: (query?: Record<string, unknown>) =>
        this.transport.rawRequest<unknown>({
          method: 'GET',
          path: `${this.basePath}/pipeline`,
          ...(query ? { query } : {}),
        }),
      stats: (query?: Record<string, unknown>) =>
        this.transport.rawRequest<unknown>({
          method: 'GET',
          path: `${this.basePath}/stats`,
          ...(query ? { query } : {}),
        }),
    }
  }
}
