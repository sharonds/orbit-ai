import type { ListQuery } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

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

export class ImportResource {
  constructor(
    private readonly transport: OrbitTransport,
    private readonly basePath = '/v1/imports',
  ) {}

  async create(input: CreateImportInput): Promise<ImportRecord> {
    const response = await this.transport.request<ImportRecord>({
      method: 'POST',
      path: this.basePath,
      body: input,
    })
    return response.data
  }

  async get(id: string): Promise<ImportRecord> {
    const response = await this.transport.request<ImportRecord>({
      method: 'GET',
      path: `${this.basePath}/${id}`,
    })
    return response.data
  }

  list(query: ListQuery = {}): AutoPager<ImportRecord> {
    return new AutoPager<ImportRecord>(this.transport, this.basePath, query)
  }

  response() {
    return {
      create: (input: CreateImportInput) =>
        this.transport.rawRequest<ImportRecord>({
          method: 'POST',
          path: this.basePath,
          body: input,
        }),
      get: (id: string) =>
        this.transport.rawRequest<ImportRecord>({
          method: 'GET',
          path: `${this.basePath}/${id}`,
        }),
    }
  }
}
