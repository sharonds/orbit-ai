import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface ImportRecord {
  id: string
  object: 'import'
  organization_id: string
  entity_type: string
  status: string
  total_rows: number
  processed_rows: number
  failed_rows: number
  errors: unknown[]
  created_at: string
  updated_at: string
}

export interface CreateImportInput {
  entity_type: string
  status?: string
  total_rows?: number
}

export interface UpdateImportInput extends Partial<CreateImportInput> {}

export class ImportResource extends BaseResource<ImportRecord, CreateImportInput, UpdateImportInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/imports')
  }
}
