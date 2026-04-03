import type { OrbitClientOptions } from './config.js'
import { createTransport, type OrbitTransport } from './transport/index.js'

export class OrbitClient {
  private readonly transport: OrbitTransport

  constructor(public readonly options: OrbitClientOptions) {
    this.transport = createTransport(options)
  }
}
