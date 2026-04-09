import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface UserRecord {
  id: string
  object: 'user'
  organization_id: string
  name: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

export interface CreateUserInput {
  name: string
  email: string
  role?: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  role?: string
}

export class UserResource extends BaseResource<UserRecord, CreateUserInput, UpdateUserInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/users')
  }
}
