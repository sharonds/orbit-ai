import { toWebhookRead, type WebhookRead } from '@orbit-ai/api'
import { truncateUnknownStrings } from './truncation.js'

export interface McpIntegrationConnectionRead {
  id?: string
  provider?: string
  organization_id?: string
  credentials_redacted: true
}

export function sanitizeWebhookRead(record: Record<string, unknown>): WebhookRead {
  return toWebhookRead(record)
}

export function sanitizeSecretBearingRecord(objectType: string, record: unknown): unknown {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record
  }

  if (objectType === 'webhooks') {
    const webhook = sanitizeWebhookRead(record as Record<string, unknown>)
    return {
      id: webhook.id,
      object: webhook.object,
      organization_id: webhook.organization_id,
      url: webhook.url,
      events: webhook.events,
      status: webhook.status,
      description: webhook.description,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at,
      secret_last_four: webhook.signing_secret_last_four,
      secret_created_at: webhook.signing_secret_created_at,
    }
  }

  const blocked = new Set([
    'access_token',
    'refresh_token',
    'accessToken',
    'refreshToken',
    'signing_secret',
    'signingSecret',
    'secret',
  ])

  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key))
      .map(([key, value]) => [key, truncateUnknownStrings(value, 10_000)]),
  )
}

export function toMcpIntegrationConnectionRead(record: Record<string, unknown>): McpIntegrationConnectionRead {
  return {
    ...(record.id ? { id: String(record.id) } : {}),
    ...(record.provider ? { provider: String(record.provider) } : {}),
    ...(record.organization_id ? { organization_id: String(record.organization_id) } : {}),
    credentials_redacted: true,
  }
}
