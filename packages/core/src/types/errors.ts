export const ORBIT_ERROR_CODES = [
  'AUTH_INVALID_API_KEY',
  'AUTH_INSUFFICIENT_SCOPE',
  'AUTH_CONTEXT_REQUIRED',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'INVALID_CURSOR',
  'RESOURCE_NOT_FOUND',
  'RELATION_NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'SCHEMA_INVALID_FIELD',
  'SCHEMA_ENTITY_EXISTS',
  'SCHEMA_DESTRUCTIVE_BLOCKED',
  'SCHEMA_INCOMPATIBLE_PROMOTION',
  'MIGRATION_FAILED',
  'MIGRATION_AUTHORITY_UNAVAILABLE',
  'DESTRUCTIVE_CONFIRMATION_REQUIRED',
  'DESTRUCTIVE_CONFIRMATION_STALE',
  'MIGRATION_CONFLICT',
  'ROLLBACK_PRECONDITION_FAILED',
  'MIGRATION_OPERATION_UNSUPPORTED',
  'ADAPTER_UNAVAILABLE',
  'ADAPTER_TRANSACTION_FAILED',
  'RLS_GENERATION_FAILED',
  'WEBHOOK_DELIVERY_FAILED',
  'SEARCH_RESULT_TOO_LARGE',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const

export type OrbitErrorCode = (typeof ORBIT_ERROR_CODES)[number]

export const ORBIT_ERROR_STATUS_MAP = {
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
  MIGRATION_AUTHORITY_UNAVAILABLE: 503,
  DESTRUCTIVE_CONFIRMATION_REQUIRED: 409,
  DESTRUCTIVE_CONFIRMATION_STALE: 409,
  MIGRATION_CONFLICT: 409,
  ROLLBACK_PRECONDITION_FAILED: 412,
  MIGRATION_OPERATION_UNSUPPORTED: 400,
  ADAPTER_UNAVAILABLE: 503,
  ADAPTER_TRANSACTION_FAILED: 500,
  RLS_GENERATION_FAILED: 500,
  WEBHOOK_DELIVERY_FAILED: 502,
  SEARCH_RESULT_TOO_LARGE: 400,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
} satisfies Record<OrbitErrorCode, number>

export function orbitErrorCodeToStatus(code: OrbitErrorCode | string): number {
  return ORBIT_ERROR_STATUS_MAP[code as OrbitErrorCode] ?? 500
}

export interface OrbitErrorShape {
  code: OrbitErrorCode
  message: string
  field?: string | undefined
  request_id?: string | undefined
  doc_url?: string | undefined
  hint?: string | undefined
  recovery?: string | undefined
  retryable?: boolean | undefined
  details?: Record<string, unknown> | undefined
}

export class OrbitError extends Error implements OrbitErrorShape {
  code: OrbitErrorCode
  field: string | undefined
  request_id: string | undefined
  doc_url: string | undefined
  hint: string | undefined
  recovery: string | undefined
  retryable: boolean | undefined
  details: Record<string, unknown> | undefined

  constructor(shape: OrbitErrorShape) {
    super(shape.message)
    this.name = 'OrbitError'
    this.code = shape.code
    if (shape.field !== undefined) {
      this.field = shape.field
    }
    if (shape.request_id !== undefined) {
      this.request_id = shape.request_id
    }
    if (shape.doc_url !== undefined) {
      this.doc_url = shape.doc_url
    }
    if (shape.hint !== undefined) {
      this.hint = shape.hint
    }
    if (shape.recovery !== undefined) {
      this.recovery = shape.recovery
    }
    if (shape.retryable !== undefined) {
      this.retryable = shape.retryable
    }
    if (shape.details !== undefined) {
      this.details = shape.details
    }
  }
}

export function createOrbitError(shape: OrbitErrorShape): OrbitError {
  return new OrbitError(shape)
}
