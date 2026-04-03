import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface StageRecord {
  id: string
  object: 'stage'
  organization_id: string
  pipeline_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface CreateStageInput {
  pipeline_id: string
  name: string
  position?: number
}

export interface UpdateStageInput {
  name?: string
  position?: number
}

export class StageResource extends BaseResource<StageRecord, CreateStageInput, UpdateStageInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/stages')
  }
}
