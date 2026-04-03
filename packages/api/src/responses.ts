import type { Context } from 'hono'
import type {
  InternalPaginatedResult,
  OrbitEnvelope,
  OrbitErrorCode,
} from '@orbit-ai/core'
import './context.js'

export function toEnvelope<T>(
  c: Context,
  data: T,
  page?: InternalPaginatedResult<unknown>,
): OrbitEnvelope<T> {
  return {
    data,
    meta: page
      ? {
          request_id: c.get('requestId'),
          cursor: null,
          next_cursor: page.nextCursor ?? null,
          has_more: page.hasMore ?? false,
          version: c.get('orbitVersion'),
        }
      : {
          request_id: c.get('requestId'),
          cursor: null,
          next_cursor: null,
          has_more: false,
          version: c.get('orbitVersion'),
        },
    links: {
      self: c.req.path,
    },
  }
}

export function toError(
  c: Context,
  code: OrbitErrorCode,
  message: string,
  extra?: {
    field?: string
    hint?: string
    recovery?: string
    retryable?: boolean
  },
) {
  return {
    error: {
      code,
      message,
      request_id: c.get('requestId'),
      doc_url: `https://orbit-ai.dev/docs/errors#${code.toLowerCase()}`,
      retryable: false,
      ...extra,
    },
  }
}

// --- Sanitization helpers ---

export interface WebhookRead {
  id: string
  object: 'webhook'
  organization_id: string
  url: string
  events: string[]
  status: 'active' | 'disabled'
  description: string | null
  signing_secret_last_four: string | null
  signing_secret_created_at: string | null
  created_at: string
  updated_at: string
}

export function toWebhookRead(
  record: Record<string, unknown>,
): WebhookRead {
  return {
    id: String(record.id),
    object: 'webhook',
    organization_id: String(
      record.organization_id ?? record.organizationId,
    ),
    url: String(record.url),
    events: Array.isArray(record.events)
      ? (record.events as string[])
      : [],
    status: (record.status as WebhookRead['status']) ?? 'active',
    description: (record.description as string | null) ?? null,
    signing_secret_last_four:
      String(
        record.secret_last_four ?? record.secretLastFour ?? '',
      ).slice(-4) || null,
    signing_secret_created_at:
      (record.secret_created_at as string | null) ??
      (record.secretCreatedAt as string | null) ??
      null,
    created_at: String(record.created_at ?? record.createdAt),
    updated_at: String(record.updated_at ?? record.updatedAt),
  }
}

export interface WebhookDeliveryRead {
  id: string
  object: 'webhook_delivery'
  organization_id: string
  webhook_id: string
  event_id: string
  status: 'pending' | 'succeeded' | 'failed'
  response_status: number | null
  attempt_count: number
  next_retry_at: string | null
  delivered_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export function toWebhookDeliveryRead(
  record: Record<string, unknown>,
): WebhookDeliveryRead {
  return {
    id: String(record.id),
    object: 'webhook_delivery',
    organization_id: String(
      record.organization_id ?? record.organizationId,
    ),
    webhook_id: String(record.webhook_id ?? record.webhookId),
    event_id: String(record.event_id ?? record.eventId),
    status:
      (record.status as WebhookDeliveryRead['status']) ?? 'pending',
    response_status:
      (record.response_status as number | null) ??
      (record.responseStatus as number | null) ??
      null,
    attempt_count: Number(
      record.attempt_count ?? record.attemptCount ?? 0,
    ),
    next_retry_at:
      (record.next_attempt_at as string | null) ??
      (record.nextAttemptAt as string | null) ??
      null,
    delivered_at:
      (record.delivered_at as string | null) ??
      (record.deliveredAt as string | null) ??
      null,
    last_error:
      (record.last_error as string | null) ??
      (record.lastError as string | null) ??
      null,
    created_at: String(record.created_at ?? record.createdAt),
    updated_at: String(record.updated_at ?? record.updatedAt),
  }
}

export function sanitizePublicRead(
  entity: string,
  record: unknown,
): unknown {
  if (entity === 'webhooks')
    return toWebhookRead(record as Record<string, unknown>)
  return record
}

export function sanitizePublicPage(
  entity: string,
  rows: unknown[],
): unknown[] {
  return rows.map((row) => sanitizePublicRead(entity, row))
}

export function toApiKeyRead(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const { keyHash, encryptedKey, ...safe } = record
  return safe
}

export function toIdempotencyKeyRead(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const { requestHash, responseBody, ...safe } = record
  return safe
}

export function toAuditLogRead(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const REDACTED = [
    'keyHash',
    'encryptedKey',
    'secretEncrypted',
    'accessTokenEncrypted',
    'refreshTokenEncrypted',
  ]
  const sanitizeSnapshot = (s: unknown): unknown => {
    if (!s || typeof s !== 'object') return s
    return Object.fromEntries(
      Object.entries(s as Record<string, unknown>).filter(
        ([k]) => !REDACTED.includes(k),
      ),
    )
  }
  return {
    ...record,
    before: sanitizeSnapshot(record.before),
    after: sanitizeSnapshot(record.after),
  }
}

export function sanitizeAdminRead(
  entity: string,
  record: unknown,
): unknown {
  if (entity === 'webhook_deliveries')
    return toWebhookDeliveryRead(record as Record<string, unknown>)
  if (entity === 'api_keys')
    return toApiKeyRead(record as Record<string, unknown>)
  if (entity === 'idempotency_keys')
    return toIdempotencyKeyRead(record as Record<string, unknown>)
  if (entity === 'audit_logs')
    return toAuditLogRead(record as Record<string, unknown>)
  return record
}

export function sanitizeAdminPage(
  entity: string,
  rows: unknown[],
): unknown[] {
  return rows.map((row) => sanitizeAdminRead(entity, row))
}
