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
  'ADAPTER_UNAVAILABLE',
  'ADAPTER_TRANSACTION_FAILED',
  'RLS_GENERATION_FAILED',
  'WEBHOOK_DELIVERY_FAILED',
  'SEARCH_RESULT_TOO_LARGE',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const

export type OrbitErrorCode = (typeof ORBIT_ERROR_CODES)[number]

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
