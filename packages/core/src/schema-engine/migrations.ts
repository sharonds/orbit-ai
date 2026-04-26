import { createHash } from 'node:crypto'
import { z } from 'zod'

import type { AdapterDialect, AdapterName } from '../adapters/interface.js'

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,62}$/
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/

const adapterNameSchema = z.enum(['supabase', 'neon', 'postgres', 'sqlite'])
const adapterDialectSchema = z.enum(['postgres', 'sqlite'])
const identifierSchema = z.string().min(1).max(63).regex(IDENTIFIER_PATTERN)
const entityTypeSchema = identifierSchema
const fieldNameSchema = identifierSchema
const tableNameSchema = identifierSchema
const columnNameSchema = identifierSchema

const customFieldTypeSchema = z.enum([
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'currency',
  'relation',
])

const semanticColumnTypeSchema = z.enum([
  'text',
  'integer',
  'number',
  'boolean',
  'date',
  'datetime',
  'json',
  'uuid',
])

const semanticScalarSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
])
const semanticParameterValueSchema = z.union([
  semanticScalarSchema,
  z.array(semanticScalarSchema),
])

export const schemaMigrationChecksumSchema = z.string().regex(CHECKSUM_PATTERN)
export type SchemaMigrationChecksum = z.infer<typeof schemaMigrationChecksumSchema>

export const schemaMigrationAdapterScopeSchema = z.object({
  name: adapterNameSchema,
  dialect: adapterDialectSchema,
}).strict()
export type SchemaMigrationAdapterScope = z.infer<typeof schemaMigrationAdapterScopeSchema>

export const schemaMigrationTrustedScopeSchema = z.object({
  orgId: z.string().min(1),
  actorId: z.string().min(1).optional(),
}).strict()
export type SchemaMigrationTrustedScope = z.infer<typeof schemaMigrationTrustedScopeSchema>

export const destructiveConfirmationSchema = z.object({
  destructive: z.literal(true),
  checksum: schemaMigrationChecksumSchema,
  confirmedAt: z.string().datetime({ offset: true }),
}).strict()
export type DestructiveConfirmation = z.infer<typeof destructiveConfirmationSchema>

export const schemaMigrationUpdateFieldInputSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  fieldType: customFieldTypeSchema.optional(),
  required: z.boolean().optional(),
  indexed: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.string()).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
}).strict()
export type SchemaMigrationUpdateFieldInput = z.infer<typeof schemaMigrationUpdateFieldInputSchema>

export const schemaMigrationDeleteFieldInputSchema = z.object({
  entityType: entityTypeSchema,
  fieldName: fieldNameSchema,
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()
export type SchemaMigrationDeleteFieldInput = z.infer<typeof schemaMigrationDeleteFieldInputSchema>

const customFieldAddOperationSchema = z.object({
  type: z.literal('custom_field.add'),
  entityType: entityTypeSchema,
  fieldName: fieldNameSchema,
  fieldType: customFieldTypeSchema,
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  required: z.boolean().optional(),
  indexed: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.string()).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
}).strict()

const customFieldUpdateOperationSchema = z.object({
  type: z.literal('custom_field.update'),
  entityType: entityTypeSchema,
  fieldName: fieldNameSchema,
  patch: schemaMigrationUpdateFieldInputSchema,
}).strict()

const customFieldDeleteOperationSchema = z.object({
  type: z.literal('custom_field.delete'),
  entityType: entityTypeSchema,
  fieldName: fieldNameSchema,
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()

const customFieldRenameOperationSchema = z.object({
  type: z.literal('custom_field.rename'),
  entityType: entityTypeSchema,
  fieldName: fieldNameSchema,
  newFieldName: fieldNameSchema,
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()

const customFieldPromoteOperationSchema = z.object({
  type: z.literal('custom_field.promote'),
  entityType: entityTypeSchema,
  fieldName: fieldNameSchema,
  columnName: columnNameSchema.optional(),
  indexed: z.boolean().optional(),
}).strict()

const columnAddOperationSchema = z.object({
  type: z.literal('column.add'),
  tableName: tableNameSchema,
  columnName: columnNameSchema,
  columnType: semanticColumnTypeSchema,
  nullable: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
}).strict()

const columnDropOperationSchema = z.object({
  type: z.literal('column.drop'),
  tableName: tableNameSchema,
  columnName: columnNameSchema,
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()

const columnRenameOperationSchema = z.object({
  type: z.literal('column.rename'),
  tableName: tableNameSchema,
  columnName: columnNameSchema,
  newColumnName: columnNameSchema,
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()

const indexAddOperationSchema = z.object({
  type: z.literal('index.add'),
  tableName: tableNameSchema,
  indexName: identifierSchema,
  columns: z.array(columnNameSchema).min(1),
  unique: z.boolean().optional(),
}).strict()

const indexDropOperationSchema = z.object({
  type: z.literal('index.drop'),
  tableName: tableNameSchema,
  indexName: identifierSchema,
}).strict()

export const schemaMigrationRollbackReferenceOperationSchema = z.object({
  type: z.literal('rollback.reference'),
  migrationId: z.string().min(1),
  checksum: schemaMigrationChecksumSchema.optional(),
}).strict()
export type SchemaMigrationRollbackReferenceOperation = z.infer<typeof schemaMigrationRollbackReferenceOperationSchema>

export const schemaMigrationInternalAdapterOperationSchema = z.object({
  type: z.literal('adapter.semantic'),
  adapter: adapterNameSchema.optional(),
  operation: z.enum([
    'copy_column_values',
    'rebuild_table',
    'refresh_rls',
    'sync_custom_field_metadata',
    'validate_constraints',
  ]),
  parameters: z.record(z.string(), semanticParameterValueSchema).optional(),
}).strict()
export type SchemaMigrationInternalAdapterOperation = z.infer<typeof schemaMigrationInternalAdapterOperationSchema>

export const schemaMigrationPublicForwardOperationSchema = z.discriminatedUnion('type', [
  customFieldAddOperationSchema,
  customFieldUpdateOperationSchema,
  customFieldDeleteOperationSchema,
  customFieldRenameOperationSchema,
  customFieldPromoteOperationSchema,
  columnAddOperationSchema,
  columnDropOperationSchema,
  columnRenameOperationSchema,
  indexAddOperationSchema,
  indexDropOperationSchema,
])
export type SchemaMigrationPublicForwardOperation = z.infer<typeof schemaMigrationPublicForwardOperationSchema>

export const schemaMigrationForwardOperationSchema = z.discriminatedUnion('type', [
  ...schemaMigrationPublicForwardOperationSchema.options,
  schemaMigrationInternalAdapterOperationSchema,
])
export type SchemaMigrationForwardOperation = z.infer<typeof schemaMigrationForwardOperationSchema>

export const schemaMigrationOperationSchema = z.discriminatedUnion('type', [
  ...schemaMigrationForwardOperationSchema.options,
  schemaMigrationRollbackReferenceOperationSchema,
])
export type SchemaMigrationOperation = z.infer<typeof schemaMigrationOperationSchema>

export const schemaMigrationPreviewInputSchema = z.object({
  operations: z.array(schemaMigrationPublicForwardOperationSchema).min(1),
}).strict()
export type SchemaMigrationPreviewInput = z.infer<typeof schemaMigrationPreviewInputSchema>

/**
 * Apply idempotency is anchored by the ledger checksum computed from adapter,
 * trusted org scope, and forward operations. The optional idempotencyKey is a
 * secondary caller retry key; schema migrations must not rely only on HTTP
 * idempotency middleware because DirectTransport bypasses that middleware.
 */
export const schemaMigrationApplyInputSchema = z.object({
  operations: z.array(schemaMigrationPublicForwardOperationSchema).min(1),
  checksum: schemaMigrationChecksumSchema,
  confirmation: destructiveConfirmationSchema.optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
}).strict()
export type SchemaMigrationApplyInput = z.infer<typeof schemaMigrationApplyInputSchema>

export const schemaMigrationRollbackInputSchema = z.object({
  migrationId: z.string().min(1),
  checksum: schemaMigrationChecksumSchema.optional(),
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()
export type SchemaMigrationRollbackInput = z.infer<typeof schemaMigrationRollbackInputSchema>

export const schemaMigrationPreviewOutputSchema = z.object({
  checksum: schemaMigrationChecksumSchema,
  operations: z.array(schemaMigrationForwardOperationSchema),
  destructive: z.boolean(),
  confirmationRequired: z.boolean(),
  warnings: z.array(z.string()),
}).strict()
export type SchemaMigrationPreviewOutput = z.infer<typeof schemaMigrationPreviewOutputSchema>

export const schemaMigrationApplyOutputSchema = z.object({
  migrationId: z.string().min(1),
  checksum: schemaMigrationChecksumSchema,
  status: z.enum(['applied', 'noop']),
  appliedOperations: z.array(schemaMigrationForwardOperationSchema),
  idempotencyKey: z.string().min(1).max(255).optional(),
}).strict()
export type SchemaMigrationApplyOutput = z.infer<typeof schemaMigrationApplyOutputSchema>

export const schemaMigrationRollbackOutputSchema = z.object({
  migrationId: z.string().min(1),
  rolledBackMigrationId: z.string().min(1),
  checksum: schemaMigrationChecksumSchema,
  status: z.literal('rolled_back'),
  operations: z.array(schemaMigrationForwardOperationSchema),
}).strict()
export type SchemaMigrationRollbackOutput = z.infer<typeof schemaMigrationRollbackOutputSchema>

export function computeSchemaMigrationChecksum(input: {
  adapter: { name: AdapterName; dialect: AdapterDialect }
  orgId: string
  operations: readonly SchemaMigrationForwardOperation[]
}): SchemaMigrationChecksum {
  const adapter = schemaMigrationAdapterScopeSchema.parse(input.adapter)
  const scope = schemaMigrationTrustedScopeSchema.parse({ orgId: input.orgId })
  const operations = z.array(schemaMigrationForwardOperationSchema).parse(input.operations)
  const canonical = stableCanonicalJson({
    version: 1,
    adapter,
    orgId: scope.orgId,
    operations,
  })

  return createHash('sha256').update(canonical).digest('hex') as SchemaMigrationChecksum
}

function stableCanonicalJson(value: unknown): string {
  return JSON.stringify(toStableValue(value))
}

function toStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize non-finite numbers')
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toStableValue)
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))

    const out: Record<string, unknown> = {}
    for (const [key, entryValue] of entries) {
      out[key] = toStableValue(entryValue)
    }
    return out
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`)
}
