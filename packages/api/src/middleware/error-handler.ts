import type { ErrorHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import type { OrbitErrorCode } from '@orbit-ai/core'
import { ZodError } from 'zod'
import '../context.js'

const ERROR_STATUS_MAP: Partial<Record<OrbitErrorCode, number>> = {
  AUTH_INVALID_API_KEY: 401,
  AUTH_INSUFFICIENT_SCOPE: 403,
  AUTH_CONTEXT_REQUIRED: 401,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 400,
  INVALID_CURSOR: 400,
  RESOURCE_NOT_FOUND: 404,
  RELATION_NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  SCHEMA_INVALID_FIELD: 400,
  SCHEMA_ENTITY_EXISTS: 409,
  SCHEMA_DESTRUCTIVE_BLOCKED: 403,
  SCHEMA_INCOMPATIBLE_PROMOTION: 400,
  MIGRATION_FAILED: 500,
  ADAPTER_UNAVAILABLE: 503,
  ADAPTER_TRANSACTION_FAILED: 500,
  RLS_GENERATION_FAILED: 500,
  WEBHOOK_DELIVERY_FAILED: 502,
  // 413 Payload Too Large — the search query would return more than the
  // per-entity-type row cap and must be refined before retrying.
  SEARCH_RESULT_TOO_LARGE: 413,
  // 413 Payload Too Large — the HTTP request body exceeds the configured limit.
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
}

export const orbitErrorHandler: ErrorHandler = (err, c) => {
  if (err instanceof OrbitError) {
    const status = ERROR_STATUS_MAP[err.code] ?? 500
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          field: err.field,
          request_id: c.get('requestId'),
          doc_url: `https://orbit-ai.dev/docs/errors#${err.code.toLowerCase()}`,
          hint: err.hint,
          recovery: err.recovery,
          retryable: err.retryable ?? false,
        },
      },
      status as Parameters<typeof c.json>[1],
    )
  }
  if (err instanceof ZodError) {
    const hint = err.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return c.json(
      {
        error: {
          code: 'VALIDATION_FAILED' as OrbitErrorCode,
          message: 'Request body failed validation',
          request_id: c.get('requestId'),
          doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
          hint,
          retryable: false,
        },
      },
      400,
    )
  }
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_FAILED' as OrbitErrorCode,
          message: 'Request body contains invalid JSON',
          request_id: c.get('requestId'),
          doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
          hint: 'Ensure the request body is valid JSON',
          retryable: false,
        },
      },
      400,
    )
  }
  // Unexpected error — log it before returning an opaque 500.
  // We log to stderr here because the api package has no opinion on which
  // structured logger to use; whatever log drain the host uses will pick up
  // stderr (Vercel, Cloudflare, Fly, Docker, etc.). Structured shape so log
  // processors can parse.
  console.error({
    msg: 'unhandled error in orbitErrorHandler',
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    request_id: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
  })

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        request_id: c.get('requestId'),
        retryable: false,
      },
    },
    500,
  )
}
