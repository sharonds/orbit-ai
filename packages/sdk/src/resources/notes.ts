import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export class NoteResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/notes')
  }
}
