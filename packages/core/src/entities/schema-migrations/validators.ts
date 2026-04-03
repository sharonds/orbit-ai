import { z } from 'zod'

import { schemaMigrationSelectSchema, schemaMigrationInsertSchema } from '../../schema/zod.js'

export const schemaMigrationRecordSchema = schemaMigrationSelectSchema
export type SchemaMigrationRecord = z.infer<typeof schemaMigrationRecordSchema>

export const sanitizedSchemaMigrationRecordSchema = schemaMigrationRecordSchema.omit({
  sqlStatements: true,
  rollbackStatements: true,
})
export type SanitizedSchemaMigrationRecord = z.infer<typeof sanitizedSchemaMigrationRecordSchema>

export function sanitizeSchemaMigrationRecord(
  record: SchemaMigrationRecord,
): SanitizedSchemaMigrationRecord {
  return sanitizedSchemaMigrationRecordSchema.parse(record)
}

export const schemaMigrationCreateInputSchema = schemaMigrationInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SchemaMigrationCreateInput = z.input<typeof schemaMigrationCreateInputSchema>
