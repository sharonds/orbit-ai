import { createHash } from 'node:crypto'
import { z } from 'zod'

import type { AdapterDialect, AdapterName } from '../adapters/interface.js'
import {
  destructiveConfirmationSchema,
  schemaMigrationChecksumSchema,
  type DestructiveConfirmation,
  type DestructiveMigrationEnvironment,
  type SchemaMigrationChecksum,
} from './destructive-confirmation.js'

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,62}$/
const RAW_PAYLOAD_KEYS = new Set(['sql', 'ddl', 'script', 'statement', 'statements'])
const RAW_SQL_TEXT_PATTERNS = [
  /^(alter|create|drop)\s+(table|index|schema|column|view|extension|database|trigger|function|procedure|role|user)\b/i,
  /^truncate\s+(table\s+)?[\w".]+\b/i,
  /^grant\s+.+\s+on\s+.+\s+to\s+/i,
  /^revoke\s+.+\s+on\s+.+\s+from\s+/i,
  /^pragma\s+[a-z_][a-z0-9_]*\s*(\(|=|\b)/i,
]
const RAW_DML_TEXT_PATTERNS = [
  /^select\s+.+\s+from\s+/i,
  /^insert\s+into\s+/i,
  /^update\s+[\w".]+\s+set\s+/i,
  /^delete\s+from\s+/i,
]
const RAW_SCRIPT_TEXT_PATTERN = /<script\b/i

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

export type SchemaMigrationSemanticValue =
  | string
  | number
  | boolean
  | null
  | SchemaMigrationSemanticValue[]
  | { [key: string]: SchemaMigrationSemanticValue }

export const schemaMigrationSemanticValueSchema = z.custom<SchemaMigrationSemanticValue>(
  (value) => isSchemaMigrationSemanticValue(value),
  { message: 'Expected a canonical semantic JSON value' },
)

export const schemaMigrationValidationSchema = z.record(z.string(), schemaMigrationSemanticValueSchema)
export type SchemaMigrationValidation = z.infer<typeof schemaMigrationValidationSchema>

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

export {
  destructiveConfirmationSchema,
  schemaMigrationChecksumSchema,
  type DestructiveConfirmation,
  type DestructiveMigrationEnvironment,
  type SchemaMigrationChecksum,
}

export const schemaMigrationUpdateFieldInputSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  fieldType: customFieldTypeSchema.optional(),
  required: z.boolean().optional(),
  indexed: z.boolean().optional(),
  defaultValue: schemaMigrationSemanticValueSchema.optional(),
  options: z.array(z.string()).optional(),
  validation: schemaMigrationValidationSchema.optional(),
}).strict()
export type SchemaMigrationUpdateFieldInput = z.infer<typeof schemaMigrationUpdateFieldInputSchema>

export const schemaMigrationUpdateFieldRequestInputSchema = schemaMigrationUpdateFieldInputSchema.extend({
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()
export type SchemaMigrationUpdateFieldRequestInput = z.infer<typeof schemaMigrationUpdateFieldRequestInputSchema>

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
  defaultValue: schemaMigrationSemanticValueSchema.optional(),
  options: z.array(z.string()).optional(),
  validation: schemaMigrationValidationSchema.optional(),
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
  defaultValue: schemaMigrationSemanticValueSchema.optional(),
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

export const schemaMigrationConfirmationInstructionsSchema = z.object({
  required: z.boolean(),
  instructions: z.string().min(1),
  destructiveOperations: z.array(z.string()),
  checksum: schemaMigrationChecksumSchema.optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).strict()
export type SchemaMigrationConfirmationInstructions = z.infer<typeof schemaMigrationConfirmationInstructionsSchema>

export const schemaMigrationPreviewOutputSchema = z.object({
  checksum: schemaMigrationChecksumSchema,
  operations: z.array(schemaMigrationForwardOperationSchema),
  destructive: z.boolean(),
  summary: z.string().min(1),
  adapter: schemaMigrationAdapterScopeSchema,
  scope: schemaMigrationTrustedScopeSchema,
  confirmationInstructions: schemaMigrationConfirmationInstructionsSchema,
  confirmationRequired: z.boolean(),
  warnings: z.array(z.string()),
}).strict()
export type SchemaMigrationPreviewOutput = z.infer<typeof schemaMigrationPreviewOutputSchema>
export const schemaMigrationPlanSchema = schemaMigrationPreviewOutputSchema
export type SchemaMigrationPlan = SchemaMigrationPreviewOutput

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

function isSchemaMigrationSemanticValue(value: unknown, seen = new WeakSet<object>()): value is SchemaMigrationSemanticValue {
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return !isRawPayloadString(value)
  if (Array.isArray(value)) return value.every((entry) => isSchemaMigrationSemanticValue(entry, seen))
  if (typeof value !== 'object') return false

  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return false
  if (seen.has(value)) return false
  seen.add(value)

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (RAW_PAYLOAD_KEYS.has(key.toLowerCase())) return false
    if (!isSchemaMigrationSemanticValue(entryValue, seen)) return false
  }

  return true
}

function isRawPayloadString(value: string): boolean {
  const trimmed = value.trim()
  return RAW_SQL_TEXT_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    RAW_DML_TEXT_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    RAW_SCRIPT_TEXT_PATTERN.test(trimmed)
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
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
      .sort(([a], [b]) => compareCodeUnits(a, b))

    const out: Record<string, unknown> = {}
    for (const [key, entryValue] of entries) {
      out[key] = toStableValue(entryValue)
    }
    return out
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`)
}
