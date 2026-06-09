import { z } from 'zod'

import {
  schemaMigrationAdapterScopeSchema,
  schemaMigrationChecksumSchema,
  schemaMigrationForwardOperationSchema,
} from '../../schema-engine/migrations.js'
import { schemaMigrationSelectSchema, schemaMigrationInsertSchema } from '../../schema/zod.js'

export const schemaMigrationStatusSchema = z.enum(['pending', 'running', 'applied', 'failed', 'rolled_back'])
export type SchemaMigrationStatus = z.infer<typeof schemaMigrationStatusSchema>

export const schemaMigrationRecordSchema = schemaMigrationSelectSchema.extend({
  checksum: schemaMigrationChecksumSchema,
  adapter: schemaMigrationAdapterScopeSchema,
  forwardOperations: z.array(schemaMigrationForwardOperationSchema),
  reverseOperations: z.array(schemaMigrationForwardOperationSchema),
  destructive: z.boolean(),
  status: schemaMigrationStatusSchema,
  sqlStatements: z.array(z.string()).default([]),
  rollbackStatements: z.array(z.string()).default([]),
  appliedBy: z.string().min(1).nullable(),
  startedAt: z.date().nullable(),
  rolledBackAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  errorCode: z.string().min(1).nullable(),
  errorMessage: z.string().min(1).nullable(),
})
export type SchemaMigrationRecord = z.infer<typeof schemaMigrationRecordSchema>

export const sanitizedSchemaMigrationRecordSchema = schemaMigrationRecordSchema.omit({
  forwardOperations: true,
  reverseOperations: true,
  sqlStatements: true,
  rollbackStatements: true,
  errorMessage: true,
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
}).extend({
  checksum: schemaMigrationChecksumSchema,
  adapter: schemaMigrationAdapterScopeSchema,
  forwardOperations: z.array(schemaMigrationForwardOperationSchema),
  reverseOperations: z.array(schemaMigrationForwardOperationSchema),
  destructive: z.boolean().default(false),
  status: schemaMigrationStatusSchema.default('pending'),
  appliedBy: z.string().min(1).nullable().optional(),
  startedAt: z.date().nullable().optional(),
  rolledBackAt: z.date().nullable().optional(),
  failedAt: z.date().nullable().optional(),
  errorCode: z.string().min(1).nullable().optional(),
  errorMessage: z.string().min(1).nullable().optional(),
})
export type SchemaMigrationCreateInput = z.input<typeof schemaMigrationCreateInputSchema>

export const schemaMigrationStatusPatchSchema = z.object({
  status: schemaMigrationStatusSchema,
  startedAt: z.date().nullable().optional(),
  appliedAt: z.date().nullable().optional(),
  rolledBackAt: z.date().nullable().optional(),
  failedAt: z.date().nullable().optional(),
  errorCode: z.string().min(1).nullable().optional(),
  errorMessage: z.string().min(1).nullable().optional(),
  appliedBy: z.string().min(1).nullable().optional(),
}).strict()
export type SchemaMigrationStatusPatch = z.infer<typeof schemaMigrationStatusPatchSchema>
