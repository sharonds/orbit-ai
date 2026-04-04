import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface ContractRecord {
  id: string
  object: 'contract'
  organization_id: string
  title: string
  status: string
  value: number | null
  currency: string | null
  start_date: string | null
  end_date: string | null
  deal_id: string | null
  contact_id: string | null
  company_id: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateContractInput {
  title: string
  status?: string
  value?: number
  currency?: string
  start_date?: string
  end_date?: string
  deal_id?: string
  contact_id?: string
  company_id?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateContractInput extends Partial<CreateContractInput> {}

export class ContractResource extends BaseResource<ContractRecord, CreateContractInput, UpdateContractInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/contracts')
  }
}
