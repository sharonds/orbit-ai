import { z } from 'zod'

import { idempotencyKeySelectSchema, idempotencyKeyInsertSchema } from '../../schema/zod.js'

export const idempotencyKeyRecordSchema = idempotencyKeySelectSchema
export type IdempotencyKeyRecord = z.infer<typeof idempotencyKeyRecordSchema>

export const sanitizedIdempotencyKeyRecordSchema = idempotencyKeyRecordSchema.omit({
  requestHash: true,
  responseBody: true,
})
export type SanitizedIdempotencyKeyRecord = z.infer<typeof sanitizedIdempotencyKeyRecordSchema>

export function sanitizeIdempotencyKeyRecord(record: IdempotencyKeyRecord): SanitizedIdempotencyKeyRecord {
  return sanitizedIdempotencyKeyRecordSchema.parse(record)
}

export const idempotencyKeyCreateInputSchema = idempotencyKeyInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type IdempotencyKeyCreateInput = z.input<typeof idempotencyKeyCreateInputSchema>
