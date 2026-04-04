import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface TaskRecord {
  id: string
  object: 'task'
  organization_id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  due_date: string | null
  contact_id: string | null
  assigned_to_user_id: string | null
  deal_id: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: string
  priority?: string
  due_date?: string
  contact_id?: string
  assigned_to_user_id?: string
  deal_id?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}

export class TaskResource extends BaseResource<TaskRecord, CreateTaskInput, UpdateTaskInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/tasks')
  }
}
