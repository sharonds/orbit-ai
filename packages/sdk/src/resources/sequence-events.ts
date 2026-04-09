import type { ListQuery } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

export interface SequenceEventRecord {
  id: string
  object: 'sequence_event'
  organization_id: string
  sequence_id: string
  enrollment_id: string
  step_id: string
  event_type: string
  status: string
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * SequenceEventResource is read-only — no create, update, or delete.
 */
export class SequenceEventResource {
  constructor(
    private readonly transport: OrbitTransport,
    private readonly basePath: string = '/v1/sequence_events',
  ) {}

  async get(id: string): Promise<SequenceEventRecord> {
    const response = await this.transport.request<SequenceEventRecord>({
      method: 'GET',
      path: `${this.basePath}/${id}`,
    })
    return response.data
  }

  list(query: ListQuery = {}): AutoPager<SequenceEventRecord> {
    return new AutoPager<SequenceEventRecord>(this.transport, this.basePath, query)
  }

  response() {
    return {
      get: (id: string) =>
        this.transport.rawRequest<SequenceEventRecord>({
          method: 'GET',
          path: `${this.basePath}/${id}`,
        }),
    }
  }
}
