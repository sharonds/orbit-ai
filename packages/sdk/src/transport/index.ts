import type { OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'

export interface TransportRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
}

export interface OrbitTransport {
  rawRequest<T>(input: TransportRequest): Promise<OrbitEnvelope<T>>
  request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>>
}

export function createTransport(options: OrbitClientOptions): OrbitTransport {
  if (options.apiKey && options.adapter) {
    throw new Error('OrbitClient must use exactly one mode: API key or adapter + context')
  }
  if (options.apiKey) {
    throw new Error('HTTP transport not yet implemented')
  }
  if (options.adapter && options.context?.orgId) {
    throw new Error('Direct transport not yet implemented')
  }
  throw new Error('OrbitClient requires either apiKey (API mode) or adapter + context (direct mode)')
}
