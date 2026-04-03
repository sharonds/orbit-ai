import type { ErrorHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import type { OrbitErrorCode } from '@orbit-ai/core'
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
