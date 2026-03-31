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
  'INTERNAL_ERROR',
] as const

export type OrbitErrorCode = (typeof ORBIT_ERROR_CODES)[number]

export interface OrbitErrorShape {
  code: OrbitErrorCode
  message: string
  field?: string
  request_id?: string
  doc_url?: string
  hint?: string
  recovery?: string
  retryable?: boolean
  details?: Record<string, unknown>
}
