import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export class SequenceStepResource extends BaseResource<any, any, any> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/sequence_steps')
  }
}
