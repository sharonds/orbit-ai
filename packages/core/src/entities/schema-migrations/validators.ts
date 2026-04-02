import { z } from 'zod'

import { schemaMigrationSelectSchema, schemaMigrationInsertSchema } from '../../schema/zod.js'

export const schemaMigrationRecordSchema = schemaMigrationSelectSchema
export type SchemaMigrationRecord = z.infer<typeof schemaMigrationRecordSchema>

export const schemaMigrationCreateInputSchema = schemaMigrationInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SchemaMigrationCreateInput = z.input<typeof schemaMigrationCreateInputSchema>
