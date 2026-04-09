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
  options?: { omitNextLink?: boolean },
): OrbitEnvelope<T> {
  const links: OrbitEnvelope<T>['links'] = { self: c.req.path }

  // L7: when there is another page, populate `links.next` with a fully
  // resolved URL — same path as the current request, but with the
  // `cursor` query parameter set to the new next_cursor and any
  // existing `cursor` overwritten. Consumers can follow `links.next`
  // directly without manually rebuilding the URL.
  //
  // `omitNextLink` must be set for POST-body paginated routes (e.g.
  // POST /v1/search) where the cursor lives in the JSON body, not the
  // query string. Appending `?cursor=…` to the URL would silently drop
  // the body criteria, producing an incorrect and misleading link.
  if (page && page.hasMore && page.nextCursor && !options?.omitNextLink) {
    try {
      const reqUrl = new URL(c.req.url)
      reqUrl.searchParams.set('cursor', page.nextCursor)
      // Preserve only the path + query so the link is server-relative.
      links.next = `${reqUrl.pathname}${reqUrl.search}`
    } catch {
      // c.req.url should always be a valid URL, but if for any reason
      // it isn't (e.g. test harness using a relative path) fall back
      // to a path-only construction.
      const sep = c.req.path.includes('?') ? '&' : '?'
      links.next = `${c.req.path}${sep}cursor=${encodeURIComponent(page.nextCursor)}`
    }
  }

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
    links,
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

/**
 * Sanitize a single entity record before returning it to clients.
 *
 * For `webhooks`, delegates to `toWebhookRead` which applies a specific
 * allowlist. For all other entities, strips any field whose key starts
 * with an underscore — a conservative convention for marking
 * internal-only columns (billing state, row versions, internal flags).
 *
 * This is a stopgap until per-entity allowlists land as part of the
 * Phase 3 type-contract work. Consumers writing internal fields into
 * records SHOULD prefix them with `_`; this function then strips them.
 */
export function sanitizePublicRead(
  entity: string,
  record: unknown,
): unknown {
  if (entity === 'webhooks') {
    return toWebhookRead(record as Record<string, unknown>)
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    if (k.startsWith('_')) continue
    out[k] = v
  }
  return out
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
    'keyHash', 'key_hash',
    'encryptedKey', 'encrypted_key',
    'secretEncrypted', 'secret_encrypted',
    'accessTokenEncrypted', 'access_token_encrypted',
    'refreshTokenEncrypted', 'refresh_token_encrypted',
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

const ORGANIZATION_PUBLIC_FIELDS = new Set([
  'id',
  'name',
  'slug',
  'metadata',
  'created_at',
  'updated_at',
])

/**
 * Scrub internal keys from the freeform `metadata` blob before returning it
 * to clients. This is a seam for future callers: today it's a no-op identity
 * function because no internal keys are known to be stored in metadata, but
 * if the core service ever starts storing billing state, feature flags, or
 * similar there, add them to INTERNAL_METADATA_KEYS below and they'll be
 * stripped automatically. Identified by Fix Pass A security review (2026-04-08).
 */
const INTERNAL_METADATA_KEYS = new Set<string>([
  // Add internal-only metadata keys here as they're discovered.
  // Examples (for future reference): '_billing_state', '_feature_flags'
])

export function scrubInternalMetadataKeys(
  metadata: unknown,
): Record<string, unknown> | unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return metadata
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
    if (!INTERNAL_METADATA_KEYS.has(k)) out[k] = v
  }
  return out
}

export function sanitizeOrganizationRead(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ORGANIZATION_PUBLIC_FIELDS.has(k)) continue
    if (k === 'metadata') {
      out[k] = scrubInternalMetadataKeys(v)
    } else {
      out[k] = v
    }
  }
  return out
}

const API_KEY_PUBLIC_FIELDS = new Set([
  'id',
  'name',
  'scopes',
  'api_key', // raw key is intentionally returned ONCE on creation
  'expires_at',
  'organization_id',
  'created_at',
  'updated_at',
])

/**
 * Strips underscore-prefixed fields from schema introspection results.
 * A conservative default for routes that return schema metadata (object
 * type definitions, column metadata, migration plans) where there is no
 * fixed public-field allowlist. Underscore-prefixed keys are reserved for
 * internal use by convention.
 */
export function sanitizeSchemaRead(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.startsWith('_')) continue // strip internal-only fields by convention
    out[k] = v
  }
  return out
}

export function sanitizeApiKeyRead(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (API_KEY_PUBLIC_FIELDS.has(k)) out[k] = v
  }
  return out
}
