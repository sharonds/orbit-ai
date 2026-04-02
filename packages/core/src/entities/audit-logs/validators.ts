import { z } from 'zod'

import { auditLogSelectSchema, auditLogInsertSchema } from '../../schema/zod.js'

export const auditLogRecordSchema = auditLogSelectSchema
export type AuditLogRecord = z.infer<typeof auditLogRecordSchema>

export const sanitizedAuditLogRecordSchema = auditLogRecordSchema.omit({
  before: true,
  after: true,
})
export type SanitizedAuditLogRecord = z.infer<typeof sanitizedAuditLogRecordSchema>

export function sanitizeAuditLogRecord(record: AuditLogRecord): SanitizedAuditLogRecord {
  return sanitizedAuditLogRecordSchema.parse(record)
}

export const auditLogCreateInputSchema = auditLogInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type AuditLogCreateInput = z.input<typeof auditLogCreateInputSchema>
