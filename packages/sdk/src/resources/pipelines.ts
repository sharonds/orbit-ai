import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface PipelineRecord {
  id: string
  object: 'pipeline'
  organization_id: string
  name: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreatePipelineInput {
  name: string
  description?: string
  is_default?: boolean
}

export interface UpdatePipelineInput extends Partial<CreatePipelineInput> {}

export class PipelineResource extends BaseResource<PipelineRecord, CreatePipelineInput, UpdatePipelineInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/pipelines')
  }
}
