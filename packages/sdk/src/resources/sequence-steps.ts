import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface SequenceStepRecord {
  id: string
  object: 'sequence_step'
  organization_id: string
  sequence_id: string
  step_order: number
  action_type: string
  delay_minutes: number | null
  template: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateSequenceStepInput {
  sequence_id: string
  step_order: number
  action_type: string
  delay_minutes?: number
  template?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateSequenceStepInput extends Partial<CreateSequenceStepInput> {}

export class SequenceStepResource extends BaseResource<SequenceStepRecord, CreateSequenceStepInput, UpdateSequenceStepInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/sequence_steps')
  }
}
