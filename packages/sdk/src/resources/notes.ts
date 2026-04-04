import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface NoteRecord {
  id: string
  object: 'note'
  organization_id: string
  body: string
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  user_id: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateNoteInput {
  body: string
  contact_id?: string
  company_id?: string
  deal_id?: string
  user_id?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateNoteInput extends Partial<CreateNoteInput> {}

export class NoteResource extends BaseResource<NoteRecord, CreateNoteInput, UpdateNoteInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/notes')
  }
}
