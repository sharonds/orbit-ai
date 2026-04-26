import { generateId } from '../ids/generate-id.js'
import { assertOrgContext } from '../services/service-helpers.js'
import { createOrbitError } from '../types/errors.js'
import type { MigrationDatabase, OrbitAuthContext, SchemaSnapshot, StorageAdapter } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'
import type { SchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import type { CustomFieldDefinition } from '../types/schema.js'
import {
  computeSchemaMigrationChecksum,
  schemaMigrationApplyInputSchema,
  schemaMigrationDeleteFieldInputSchema,
  schemaMigrationPreviewInputSchema,
  schemaMigrationPreviewOutputSchema,
  schemaMigrationRollbackInputSchema,
  schemaMigrationUpdateFieldInputSchema,
  type SchemaMigrationAdapterScope,
  type SchemaMigrationForwardOperation,
  type SchemaMigrationPreviewOutput,
  type SchemaMigrationPublicForwardOperation,
} from './migrations.js'

/** CRM entity types that appear in the public schema listing. */
const PUBLIC_CRM_ENTITY_TYPES = [
  'contacts',
  'companies',
  'deals',
  'pipelines',
  'stages',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'tags',
  'users',
] as const

export type PublicCrmEntityType = (typeof PUBLIC_CRM_ENTITY_TYPES)[number]

export interface SchemaObjectSummary {
  type: string
  customFields: CustomFieldDefinitionRecord[]
}

export type SchemaMigrationAuthorityOperation = 'apply' | 'rollback'

export interface SchemaMigrationAuthorityContext {
  ctx: OrbitAuthContext
  operation: SchemaMigrationAuthorityOperation
  checksum?: string
  migrationId?: string
}

export interface SchemaMigrationAuthority {
  run<T>(context: SchemaMigrationAuthorityContext, fn: (db: MigrationDatabase) => Promise<T>): Promise<T>
}

export interface OrbitSchemaEngineDependencies {
  customFields: () => CustomFieldDefinitionRepository
  ledger: () => SchemaMigrationRepository
  adapter?: () => SchemaEngineSchemaAdapter
  migrationAuthority?: SchemaMigrationAuthority
}

export type SchemaEngineSchemaAdapter = Pick<
  StorageAdapter,
  'name' | 'dialect' | 'supportsJsonbIndexes' | 'getSchemaSnapshot'
>

const ALLOWED_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone', 'currency', 'relation'] as const
const DESTRUCTIVE_APPLY_OPERATION_TYPES = new Set([
  'custom_field.delete',
  'custom_field.rename',
  'column.drop',
  'column.rename',
  'index.drop',
])
const DEFAULT_SCHEMA_SNAPSHOT: SchemaSnapshot = {
  customFields: [],
  tables: [...PUBLIC_CRM_ENTITY_TYPES, 'custom_field_definitions', 'schema_migrations'],
}
const DEFAULT_SCHEMA_ADAPTER: SchemaEngineSchemaAdapter = {
  name: 'sqlite',
  dialect: 'sqlite',
  supportsJsonbIndexes: true,
  async getSchemaSnapshot() {
    return DEFAULT_SCHEMA_SNAPSHOT
  },
}
const DESTRUCTIVE_PREVIEW_OPERATION_TYPES = new Set([
  'custom_field.delete',
  'custom_field.rename',
  'custom_field.promote',
  'column.drop',
  'column.rename',
  'index.drop',
])
const SAFE_WIDENINGS = new Set([
  'email:text',
  'url:text',
  'phone:text',
  'select:text',
  'relation:text',
  'currency:number',
  'date:datetime',
  'select:multi_select',
])

export class OrbitSchemaEngine {
  private readonly getCustomFields: () => CustomFieldDefinitionRepository
  private readonly getLedger: () => SchemaMigrationRepository
  private readonly getSchemaAdapter: () => SchemaEngineSchemaAdapter
  private readonly migrationAuthority: SchemaMigrationAuthority | undefined

  constructor(deps: OrbitSchemaEngineDependencies) {
    this.getCustomFields = deps.customFields
    this.getLedger = deps.ledger
    this.getSchemaAdapter = deps.adapter ?? (() => DEFAULT_SCHEMA_ADAPTER)
    this.migrationAuthority = deps.migrationAuthority
  }

  private get repository(): CustomFieldDefinitionRepository {
    return this.getCustomFields()
  }

  private get ledger(): SchemaMigrationRepository {
    return this.getLedger()
  }

  private get schemaAdapter(): SchemaEngineSchemaAdapter {
    return this.getSchemaAdapter()
  }

  private requireMigrationAuthority(): SchemaMigrationAuthority {
    if (!this.migrationAuthority) {
      throw createOrbitError({
        code: 'MIGRATION_AUTHORITY_UNAVAILABLE',
        message: 'Schema migration authority is not configured for this service container',
        hint: 'Pass an explicit migrationAuthority to createCoreServices when this process is allowed to run schema migrations.',
        retryable: false,
      })
    }
    return this.migrationAuthority
  }

  private async listAllCustomFields(
    ctx: OrbitAuthContext,
    filter?: Record<string, unknown>,
  ): Promise<CustomFieldDefinitionRecord[]> {
    const fields: CustomFieldDefinitionRecord[] = []
    let cursor: string | undefined

    do {
      const result = await this.repository.list(ctx, {
        limit: 500,
        ...(cursor ? { cursor } : {}),
        ...(filter ? { filter } : {}),
      })
      fields.push(...result.data)
      cursor = result.nextCursor ?? undefined
    } while (cursor)

    return fields
  }

  private validationFailed(message: string, field: string): never {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message,
      field,
    })
  }

  private unsupportedMigrationOperation(operation: string): never {
    throw createOrbitError({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
      message: `${operation} is not implemented by OrbitSchemaEngine yet`,
      details: { operation },
    })
  }

  private destructiveConfirmationRequired(operations: string[], checksum: string): never {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
      message: 'Destructive schema migration operations require confirmation before elevated execution',
      details: {
        destructiveOperations: operations,
        checksum,
      },
    })
  }

  private destructiveConfirmationStale(checksum: string, confirmationChecksum: string): never {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
      message: 'Destructive schema migration confirmation checksum does not match the requested migration checksum',
      details: {
        checksum,
        confirmationChecksum,
      },
    })
  }

  async listObjects(ctx: OrbitAuthContext): Promise<SchemaObjectSummary[]> {
    assertOrgContext(ctx)
    const allFields = await this.listAllCustomFields(ctx)

    return PUBLIC_CRM_ENTITY_TYPES.map((type) => ({
      type,
      customFields: allFields.filter((f) => f.entityType === type),
    }))
  }

  async getObject(ctx: OrbitAuthContext, type: string): Promise<SchemaObjectSummary | null> {
    assertOrgContext(ctx)
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(type as PublicCrmEntityType)) {
      return null
    }
    const customFields = await this.listAllCustomFields(ctx, { entity_type: type })
    return { type, customFields }
  }

  async addField(
    ctx: OrbitAuthContext,
    entityType: string,
    body: Record<string, unknown>,
  ): Promise<CustomFieldDefinitionRecord> {
    const orgId = assertOrgContext(ctx)
    const name = body.name as string | undefined
    const type = body.type as string | undefined

    if (!name || typeof name !== 'string') {
      this.validationFailed('Field name is required', 'name')
    }
    if (!type || typeof type !== 'string') {
      this.validationFailed('Field type is required', 'type')
    }
    if (!ALLOWED_FIELD_TYPES.includes(type as typeof ALLOWED_FIELD_TYPES[number])) {
      this.validationFailed(`Unknown field type: ${type}. Allowed: ${ALLOWED_FIELD_TYPES.join(', ')}`, 'type')
    }
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(entityType as PublicCrmEntityType)) {
      this.validationFailed(`Unknown entity type: ${entityType}`, 'entityType')
    }

    const now = new Date()
    const record: CustomFieldDefinitionRecord = {
      id: generateId('customField'),
      organizationId: orgId,
      entityType,
      fieldName: name,
      fieldType: type as CustomFieldDefinitionRecord['fieldType'],
      label: (body.label as string | undefined) ?? name,
      description: (body.description as string | undefined) ?? null,
      isRequired: (body.required as boolean | undefined) ?? false,
      isIndexed: false,
      isPromoted: false,
      promotedColumnName: null,
      defaultValue: null,
      options: [],
      validation: {},
      createdAt: now,
      updatedAt: now,
    }

    return this.repository.create(ctx, record)
  }

  async preview(
    ctx: OrbitAuthContext,
    data: Record<string, unknown>,
  ): Promise<SchemaMigrationPreviewOutput> {
    const orgId = assertOrgContext(ctx)
    const input = schemaMigrationPreviewInputSchema.parse(data)
    const adapter = this.schemaAdapter
    const adapterScope: SchemaMigrationAdapterScope = {
      name: adapter.name,
      dialect: adapter.dialect,
    }
    const [repositoryFields, snapshot, ledgerState] = await Promise.all([
      this.listAllCustomFields(ctx),
      adapter.getSchemaSnapshot(),
      this.ledger.list(ctx, { limit: 25, filter: { status: 'running' } }),
    ])
    const customFields = mergeCustomFieldSources(orgId, snapshot.customFields, repositoryFields)
    const warnings = createLedgerWarnings(ledgerState.data.length)
    const operations = input.operations.map((operation) => operation as SchemaMigrationForwardOperation)
    const destructiveOperations = input.operations
      .filter((operation) => classifyPreviewOperation(operation, {
        adapter,
        customFields,
        snapshot,
        warnings,
      }).destructive)
      .map((operation) => operation.type)
    const destructive = destructiveOperations.length > 0
    const checksum = computeSchemaMigrationChecksum({
      adapter: adapterScope,
      orgId,
      operations,
    })
    const output = {
      checksum,
      operations,
      destructive,
      summary: summarizePreviewOperations(input.operations),
      adapter: adapterScope,
      scope: {
        orgId,
        ...(ctx.userId ? { actorId: ctx.userId } : {}),
      },
      confirmationInstructions: createConfirmationInstructions(destructiveOperations, checksum),
      confirmationRequired: destructive,
      warnings,
    }

    return schemaMigrationPreviewOutputSchema.parse(output)
  }

  async apply(
    ctx: OrbitAuthContext,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    assertOrgContext(ctx)
    const input = schemaMigrationApplyInputSchema.parse(data)
    void this.ledger
    const destructiveOperations = input.operations
      .filter((operation) => DESTRUCTIVE_APPLY_OPERATION_TYPES.has(operation.type))
      .map((operation) => operation.type)
    if (destructiveOperations.length > 0 && !input.confirmation) {
      this.destructiveConfirmationRequired(destructiveOperations, input.checksum)
    }
    if (destructiveOperations.length > 0) {
      const confirmation = input.confirmation
      if (confirmation && confirmation.checksum !== input.checksum) {
        this.destructiveConfirmationStale(input.checksum, confirmation.checksum)
      }
    }

    await this.requireMigrationAuthority().run({
      ctx,
      operation: 'apply',
      checksum: input.checksum,
    }, async () => undefined)
    return {
      migrationId: generateId('migration'),
      checksum: input.checksum,
      status: 'noop',
      appliedOperations: [],
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    }
  }

  async rollback(
    ctx: OrbitAuthContext,
    migration: string | Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    assertOrgContext(ctx)
    const input = typeof migration === 'string'
      ? schemaMigrationRollbackInputSchema.parse({ migrationId: migration })
      : schemaMigrationRollbackInputSchema.parse(migration)
    void this.ledger
    await this.requireMigrationAuthority().run({
      ctx,
      operation: 'rollback',
      migrationId: input.migrationId,
      ...(input.checksum ? { checksum: input.checksum } : {}),
    }, async () => undefined)
    this.unsupportedMigrationOperation(`rollback:${input.migrationId}`)
  }

  async updateField(
    ctx: OrbitAuthContext,
    entityType: string,
    fieldName: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    assertOrgContext(ctx)
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(entityType as PublicCrmEntityType)) {
      this.validationFailed(`Unknown entity type: ${entityType}`, 'entityType')
    }
    schemaMigrationUpdateFieldInputSchema.parse(data)
    this.requireMigrationAuthority()
    this.unsupportedMigrationOperation(`custom_field.update:${entityType}.${fieldName}`)
  }

  async deleteField(
    ctx: OrbitAuthContext,
    entityType: string,
    fieldName: string,
  ): Promise<void> {
    assertOrgContext(ctx)
    schemaMigrationDeleteFieldInputSchema.parse({ entityType, fieldName })
    this.requireMigrationAuthority()
    this.unsupportedMigrationOperation(`custom_field.delete:${entityType}.${fieldName}`)
  }
}

interface PreviewClassificationContext {
  adapter: SchemaEngineSchemaAdapter
  customFields: Map<string, CustomFieldDefinition | CustomFieldDefinitionRecord>
  snapshot: SchemaSnapshot
  warnings: string[]
}

function mergeCustomFieldSources(
  orgId: string,
  snapshotFields: CustomFieldDefinition[],
  repositoryFields: CustomFieldDefinitionRecord[],
): Map<string, CustomFieldDefinition | CustomFieldDefinitionRecord> {
  const fields = new Map<string, CustomFieldDefinition | CustomFieldDefinitionRecord>()
  for (const field of snapshotFields) {
    if (field.organizationId === orgId) {
      fields.set(customFieldKey(field.entityType, field.fieldName), field)
    }
  }
  for (const field of repositoryFields) {
    fields.set(customFieldKey(field.entityType, field.fieldName), field)
  }
  return fields
}

function customFieldKey(entityType: string, fieldName: string): string {
  return `${entityType}.${fieldName}`
}

function createLedgerWarnings(runningMigrationCount: number): string[] {
  if (runningMigrationCount === 0) return []
  return [
    `${runningMigrationCount} schema migration${runningMigrationCount === 1 ? ' is' : 's are'} already running for this organization.`,
  ]
}

function classifyPreviewOperation(
  operation: SchemaMigrationPublicForwardOperation,
  context: PreviewClassificationContext,
): { destructive: boolean } {
  if (DESTRUCTIVE_PREVIEW_OPERATION_TYPES.has(operation.type)) {
    warnIfMissingCustomField(operation, context)
    return { destructive: true }
  }

  switch (operation.type) {
    case 'custom_field.add':
      if (operation.required === true && operation.defaultValue === undefined) {
        context.warnings.push(
          `Adding required custom field ${operation.entityType}.${operation.fieldName} without a default can invalidate existing records.`,
        )
        return { destructive: true }
      }
      return { destructive: false }

    case 'custom_field.update':
      return classifyCustomFieldUpdate(operation, context)

    case 'column.add':
      if (!context.snapshot.tables.includes(operation.tableName)) {
        context.warnings.push(
          `Adapter schema snapshot does not include table ${operation.tableName}; non-destructive column support is not proven.`,
        )
        return { destructive: true }
      }
      if (operation.nullable === false && operation.defaultValue === undefined) {
        context.warnings.push(
          `Adding non-null column ${operation.tableName}.${operation.columnName} without a default can invalidate existing rows.`,
        )
        return { destructive: true }
      }
      return { destructive: false }

    case 'index.add':
      if (!context.snapshot.tables.includes(operation.tableName)) {
        context.warnings.push(
          `Adapter schema snapshot does not include table ${operation.tableName}; non-destructive index support is not proven.`,
        )
        return { destructive: true }
      }
      return { destructive: false }

    default:
      return { destructive: false }
  }
}

function classifyCustomFieldUpdate(
  operation: Extract<SchemaMigrationPublicForwardOperation, { type: 'custom_field.update' }>,
  context: PreviewClassificationContext,
): { destructive: boolean } {
  const existing = context.customFields.get(customFieldKey(operation.entityType, operation.fieldName))
  if (!existing) {
    context.warnings.push(
      `Custom field ${operation.entityType}.${operation.fieldName} was not found in metadata or adapter snapshot; update safety cannot be proven.`,
    )
    return { destructive: true }
  }

  if (operation.patch.required === true && existing.isRequired === false) {
    context.warnings.push(
      `Making custom field ${operation.entityType}.${operation.fieldName} required can invalidate existing records.`,
    )
    return { destructive: true }
  }

  if (operation.patch.fieldType && operation.patch.fieldType !== existing.fieldType) {
    if (isCompatibleCustomFieldWidening(existing.fieldType, operation.patch.fieldType)) {
      return { destructive: false }
    }
    context.warnings.push(
      `Changing custom field ${operation.entityType}.${operation.fieldName} from ${existing.fieldType} to ${operation.patch.fieldType} can lose or reject existing data.`,
    )
    return { destructive: true }
  }

  if (operation.patch.options && removesCustomFieldOptions(existing.options, operation.patch.options)) {
    context.warnings.push(
      `Removing options from custom field ${operation.entityType}.${operation.fieldName} can orphan existing values.`,
    )
    return { destructive: true }
  }

  if (operation.patch.indexed === true && existing.isIndexed === false && !context.adapter.supportsJsonbIndexes) {
    context.warnings.push(
      `Adapter ${context.adapter.name} has not proven JSONB custom-field index support.`,
    )
    return { destructive: true }
  }

  return { destructive: false }
}

function warnIfMissingCustomField(
  operation: SchemaMigrationPublicForwardOperation,
  context: PreviewClassificationContext,
): void {
  if (
    operation.type !== 'custom_field.delete' &&
    operation.type !== 'custom_field.rename' &&
    operation.type !== 'custom_field.promote'
  ) {
    return
  }
  if (!context.customFields.has(customFieldKey(operation.entityType, operation.fieldName))) {
    context.warnings.push(
      `Custom field ${operation.entityType}.${operation.fieldName} was not found in metadata or adapter snapshot.`,
    )
  }
}

function isCompatibleCustomFieldWidening(from: string, to: string): boolean {
  return from === to || SAFE_WIDENINGS.has(`${from}:${to}`)
}

function removesCustomFieldOptions(existingOptions: string[], nextOptions: string[]): boolean {
  const next = new Set(nextOptions)
  return existingOptions.some((option) => !next.has(option))
}

function createConfirmationInstructions(
  destructiveOperations: string[],
  checksum: string,
): SchemaMigrationPreviewOutput['confirmationInstructions'] {
  if (destructiveOperations.length === 0) {
    return {
      required: false,
      instructions: 'No destructive confirmation is required.',
      destructiveOperations: [],
    }
  }

  return {
    required: true,
    instructions: 'Pass confirmation.destructive=true with this checksum when applying this migration.',
    destructiveOperations,
    checksum,
  }
}

function summarizePreviewOperations(operations: SchemaMigrationPublicForwardOperation[]): string {
  if (operations.length === 1) {
    return summarizePreviewOperation(operations[0]!)
  }
  const entityTypes = new Set(operations.map((operation) => entityTypeForSummary(operation)).filter(Boolean))
  if (entityTypes.size === 1) {
    return `Plan ${operations.length} schema operations for ${[...entityTypes][0]}`
  }
  return `Plan ${operations.length} schema operations`
}

function summarizePreviewOperation(operation: SchemaMigrationPublicForwardOperation): string {
  switch (operation.type) {
    case 'custom_field.add':
      return `Add ${operation.fieldName} custom field to ${operation.entityType}`
    case 'custom_field.update':
      return `Update ${operation.fieldName} custom field on ${operation.entityType}`
    case 'custom_field.delete':
      return `Delete ${operation.fieldName} custom field from ${operation.entityType}`
    case 'custom_field.rename':
      return `Rename ${operation.fieldName} custom field on ${operation.entityType} to ${operation.newFieldName}`
    case 'custom_field.promote':
      return `Promote ${operation.fieldName} custom field on ${operation.entityType}`
    case 'column.add':
      return `Add ${operation.columnName} column to ${operation.tableName}`
    case 'column.drop':
      return `Drop ${operation.columnName} column from ${operation.tableName}`
    case 'column.rename':
      return `Rename ${operation.columnName} column on ${operation.tableName} to ${operation.newColumnName}`
    case 'index.add':
      return `Add ${operation.indexName} index to ${operation.tableName}`
    case 'index.drop':
      return `Drop ${operation.indexName} index from ${operation.tableName}`
  }
}

function entityTypeForSummary(operation: SchemaMigrationPublicForwardOperation): string | null {
  switch (operation.type) {
    case 'custom_field.add':
    case 'custom_field.update':
    case 'custom_field.delete':
    case 'custom_field.rename':
    case 'custom_field.promote':
      return operation.entityType
    case 'column.add':
    case 'column.drop':
    case 'column.rename':
    case 'index.add':
    case 'index.drop':
      return operation.tableName
  }
}
