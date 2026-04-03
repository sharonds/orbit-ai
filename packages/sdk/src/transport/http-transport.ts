import type { OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'
import type { OrbitTransport, TransportRequest } from './index.js'
import { OrbitApiError } from '../errors.js'
import { retry } from '../retries.js'

export class HttpTransport implements OrbitTransport {
  constructor(private readonly options: OrbitClientOptions) {}

  async rawRequest<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    const idempotencyKey =
      input.headers?.['idempotency-key'] ??
      (input.method === 'GET' ? undefined : crypto.randomUUID())

    return retry(
      async () => {
        const url = new URL(input.path, this.options.baseUrl ?? 'http://localhost:3000')
        if (input.query) {
          for (const [key, value] of Object.entries(input.query)) {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
          }
        }

        const headers: Record<string, string> = {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
          'orbit-version': this.options.version ?? '2026-04-01',
          ...input.headers,
        }
        if (idempotencyKey) {
          headers['idempotency-key'] = idempotencyKey
        }

        const init: RequestInit = {
          method: input.method,
          headers,
        }
        if (input.body) {
          init.body = JSON.stringify(input.body)
        }

        const response = await fetch(url, init)

        if (!response.ok) {
          throw await OrbitApiError.fromResponse(response)
        }

        return (await response.json()) as OrbitEnvelope<T>
      },
      { maxRetries: this.options.maxRetries ?? 2 },
    )
  }

  async request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    return this.rawRequest(input)
  }
}
