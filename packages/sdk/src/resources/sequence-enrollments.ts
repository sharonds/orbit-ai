import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface SequenceEnrollmentRecord {
  id: string
  object: 'sequence_enrollment'
  organization_id: string
  sequence_id: string
  contact_id: string
  status: string
  enrolled_at: string
  completed_at: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateSequenceEnrollmentInput {
  sequence_id: string
  contact_id: string
  status?: string
  enrolled_at?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateSequenceEnrollmentInput extends Partial<CreateSequenceEnrollmentInput> {}

export class SequenceEnrollmentResource extends BaseResource<SequenceEnrollmentRecord, CreateSequenceEnrollmentInput, UpdateSequenceEnrollmentInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/sequence_enrollments')
  }

  async unenroll(id: string): Promise<SequenceEnrollmentRecord> {
    const response = await this.transport.request<SequenceEnrollmentRecord>({
      method: 'POST',
      path: `${this.basePath}/${id}/unenroll`,
    })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      unenroll: (id: string) =>
        this.transport.rawRequest<SequenceEnrollmentRecord>({
          method: 'POST',
          path: `${this.basePath}/${id}/unenroll`,
        }),
    }
  }
}
