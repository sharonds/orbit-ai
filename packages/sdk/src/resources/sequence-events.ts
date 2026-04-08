import type { ListQuery, OrbitEnvelope } from '@orbit-ai/core'
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

  /**
   * Fetch the first page of sequence events. Returns a Promise of the full
   * envelope. For multi-page iteration, use `.pages()` instead.
   */
  async list(query: ListQuery = {}): Promise<OrbitEnvelope<SequenceEventRecord[]>> {
    return new AutoPager<SequenceEventRecord>(this.transport, this.basePath, query).firstPage()
  }

  /**
   * Get an AutoPager for cursor-based multi-page iteration over sequence events.
   */
  pages(query: ListQuery = {}): AutoPager<SequenceEventRecord> {
    return new AutoPager<SequenceEventRecord>(this.transport, this.basePath, query)
  }

  response() {
    return {
      get: (id: string) =>
        this.transport.rawRequest<SequenceEventRecord>({
          method: 'GET',
          path: `${this.basePath}/${id}`,
        }),
      list: (query: ListQuery = {}) =>
        this.transport.rawRequest<SequenceEventRecord[]>({
          method: 'GET',
          path: this.basePath,
          query: query as unknown as Record<string, unknown>,
        }),
    }
  }
}
