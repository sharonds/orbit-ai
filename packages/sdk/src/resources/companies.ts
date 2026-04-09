import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface CompanyRecord {
  id: string
  object: 'company'
  organization_id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  website: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateCompanyInput {
  name: string
  domain?: string
  industry?: string
  size?: string
  website?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {}

export class CompanyResource extends BaseResource<CompanyRecord, CreateCompanyInput, UpdateCompanyInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/companies')
  }
}
