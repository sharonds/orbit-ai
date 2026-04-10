import { toWebhookRead, type WebhookRead } from '@orbit-ai/api'
import { truncateUnknownStrings } from './truncation.js'

export interface McpIntegrationConnectionRead {
  id?: string
  object: 'integration_connection'
  organization_id?: string
  provider?: string
  connection_type?: string
  user_id?: string | null
  status?: string
  provider_account_id?: string | null
  provider_webhook_registered?: boolean
  scopes?: string[]
  failure_count?: number
  last_success_at?: string | null
  last_failure_at?: string | null
  metadata_summary?: Record<string, string | number | boolean | null>
  credentials_redacted: true
  // Prevent credential fields — any object carrying these cannot satisfy this type.
  access_token?: never
  refresh_token?: never
  client_secret?: never
  private_key?: never
  created_at?: string
  updated_at?: string
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

  return sanitizeObjectDeep(record)
}

export function toMcpIntegrationConnectionRead(record: Record<string, unknown>): McpIntegrationConnectionRead {
  return {
    ...(record.id ? { id: String(record.id) } : {}),
    object: 'integration_connection',
    ...(record.organization_id ? { organization_id: String(record.organization_id) } : {}),
    ...(record.provider ? { provider: String(record.provider) } : {}),
    ...(record.connection_type ? { connection_type: String(record.connection_type) } : {}),
    ...(record.user_id !== undefined ? { user_id: record.user_id === null ? null : String(record.user_id) } : {}),
    ...(record.status ? { status: String(record.status) } : {}),
    ...(record.provider_account_id !== undefined
      ? { provider_account_id: record.provider_account_id === null ? null : String(record.provider_account_id) }
      : {}),
    ...(record.provider_webhook_registered !== undefined
      ? { provider_webhook_registered: Boolean(record.provider_webhook_registered) }
      : {}),
    ...(Array.isArray(record.scopes) ? { scopes: record.scopes.map((scope) => String(scope)) } : {}),
    ...(record.failure_count !== undefined ? { failure_count: Number(record.failure_count) } : {}),
    ...(record.last_success_at !== undefined
      ? { last_success_at: record.last_success_at === null ? null : String(record.last_success_at) }
      : {}),
    ...(record.last_failure_at !== undefined
      ? { last_failure_at: record.last_failure_at === null ? null : String(record.last_failure_at) }
      : {}),
    ...(record.metadata_summary && typeof record.metadata_summary === 'object'
      ? { metadata_summary: truncateUnknownStrings(record.metadata_summary, 5_000) as Record<string, string | number | boolean | null> }
      : {}),
    credentials_redacted: true,
    ...(record.created_at ? { created_at: String(record.created_at) } : {}),
    ...(record.updated_at ? { updated_at: String(record.updated_at) } : {}),
  }
}

export function sanitizeObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObjectDeep(item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([entryKey, entryValue]) => [entryKey, sanitizeObjectDeep(entryValue)]),
    )
  }
  // Primitives: strings are truncated at 5,000 chars; numbers, booleans, null, and undefined pass through unchanged.
  if (typeof value === 'string') {
    return value.length > 5_000 ? `${value.slice(0, 5_000 - 14)}...[truncated]` : value
  }
  return value
}

function isSensitiveKey(key: string): boolean {
  return /(token|secret|password|credential|private[_-]?key|client[_-]?secret|api[_-]?key)/i.test(key)
}
