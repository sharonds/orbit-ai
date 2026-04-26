import { Buffer } from 'node:buffer'
import { sql } from 'drizzle-orm'

import { generateId } from '../ids/generate-id.js'
import { assertOrgContext } from '../services/service-helpers.js'
import { createOrbitError } from '../types/errors.js'
import type { MigrationDatabase, OrbitAuthContext, SchemaSnapshot, StorageAdapter } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'
import type { SchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import type { SchemaMigrationRecord } from '../entities/schema-migrations/validators.js'
import type { CustomFieldDefinition } from '../types/schema.js'
import {
  assertDestructiveConfirmation,
  type DestructiveMigrationEnvironment,
} from './destructive-confirmation.js'
import {
  computeSchemaMigrationChecksum,
  schemaMigrationApplyInputSchema,
  schemaMigrationDeleteFieldInputSchema,
  schemaMigrationPreviewInputSchema,
  schemaMigrationPreviewOutputSchema,
  schemaMigrationRollbackInputSchema,
  schemaMigrationUpdateFieldRequestInputSchema,
  type SchemaMigrationAdapterScope,
  type SchemaMigrationApplyInput,
  type SchemaMigrationApplyOutput,
  type SchemaMigrationForwardOperation,
  type SchemaMigrationPreviewOutput,
  type SchemaMigrationPublicForwardOperation,
  type SchemaMigrationRollbackOutput,
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
  destructiveMigrationEnvironment?: DestructiveMigrationEnvironment
}

export type SchemaEngineSchemaAdapter = Pick<
  StorageAdapter,
  'name' | 'dialect' | 'supportsJsonbIndexes' | 'getSchemaSnapshot'
>

const ALLOWED_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone', 'currency', 'relation'] as const
const DEFAULT_SCHEMA_SNAPSHOT: SchemaSnapshot = {
  customFields: [],
  tables: [...PUBLIC_CRM_ENTITY_TYPES, 'custom_field_definitions', 'schema_migrations'],
}
const DEFAULT_SCHEMA_ADAPTER: SchemaEngineSchemaAdapter = {
  name: 'sqlite',
  dialect: 'sqlite',
  supportsJsonbIndexes: false,
  async getSchemaSnapshot() {
    return DEFAULT_SCHEMA_SNAPSHOT
  },
}
const EXTENSIBLE_ENTITY_TABLES = {
  companies: 'companies',
  contacts: 'contacts',
  deals: 'deals',
  activities: 'activities',
  tasks: 'tasks',
  notes: 'notes',
  products: 'products',
  payments: 'payments',
  contracts: 'contracts',
  sequences: 'sequences',
} as const
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
  private readonly destructiveMigrationEnvironment: DestructiveMigrationEnvironment | undefined

  constructor(deps: OrbitSchemaEngineDependencies) {
    this.getCustomFields = deps.customFields
    this.getLedger = deps.ledger
    this.getSchemaAdapter = deps.adapter ?? (() => DEFAULT_SCHEMA_ADAPTER)
    this.migrationAuthority = deps.migrationAuthority
    this.destructiveMigrationEnvironment = deps.destructiveMigrationEnvironment
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

  private async listAllSchemaMigrations(ctx: OrbitAuthContext): Promise<SchemaMigrationRecord[]> {
    const records: SchemaMigrationRecord[] = []
    let cursor: string | undefined

    do {
      const result = await this.ledger.list(ctx, {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      })
      records.push(...result.data)
      cursor = result.nextCursor ?? undefined
    } while (cursor)

    return records
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

  private migrationConflict(message: string, details?: Record<string, unknown>): never {
    throw createOrbitError({
      code: 'MIGRATION_CONFLICT',
      message,
      details,
    })
  }

  private unsupportedCustomFieldEntity(entityType: string): never {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: `Entity type '${entityType}' does not support custom field value storage`,
      field: 'entityType',
    })
  }

  private idempotencyConflict(idempotencyKey: string): never {
    throw createOrbitError({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Schema migration idempotency key was already used with different operations',
      details: { idempotencyKey },
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
    const repositoryFields = await this.listAllCustomFields(ctx)
    const snapshot = await adapter.getSchemaSnapshot()
    const ledgerState = await this.listAllSchemaMigrations(ctx)
    const customFields = mergeCustomFieldSources(orgId, snapshot.customFields, repositoryFields)
    const ledgerClassification = buildPreviewLedgerState(ledgerState, adapterScope)
    const warnings = createLedgerWarnings(ledgerClassification.runningMigrationCount)
    const operations = input.operations.map((operation) => operation as SchemaMigrationForwardOperation)
    const destructiveOperations = input.operations
      .filter((operation) => classifyPreviewOperation(operation, {
        adapter,
        customFields,
        ledger: ledgerClassification,
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
  ): Promise<SchemaMigrationApplyOutput> {
    const orgId = assertOrgContext(ctx)
    const input = schemaMigrationApplyInputSchema.parse(data)
    const preview = await this.preview(ctx, { operations: input.operations })
    if (input.checksum !== preview.checksum) {
      this.destructiveConfirmationStale(preview.checksum, input.checksum)
    }
    if (preview.operations.length > 1) {
      this.unsupportedMigrationOperation('batch schema migrations require multi-target locking')
    }
    const existing = await this.findExistingApplyMigration(ctx, input, preview)
    if (existing) {
      if (input.idempotencyKey && existing.matchedBy !== 'idempotencyKey') {
        this.idempotencyConflict(input.idempotencyKey)
      }
      if (existing.record.status === 'applied') {
        return {
          migrationId: existing.record.id,
          checksum: existing.record.checksum,
          status: 'applied',
          appliedOperations: existing.record.forwardOperations,
          ...rollbackMetadataFor(existing.record.reverseOperations),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        }
      }
      this.migrationConflict('Schema migration is not in an idempotent applied state', {
        migrationId: existing.record.id,
        status: existing.record.status,
      })
    }
    const destructiveOperations = preview.confirmationInstructions.destructiveOperations
    assertDestructiveConfirmation({
      destructiveOperations,
      checksum: preview.checksum,
      confirmation: input.confirmation,
      runtimeEnvironment: this.destructiveMigrationEnvironment,
      requireRuntimeEnvironment: this.migrationAuthority !== undefined,
    })

    await this.assertApplyOperationPreconditions(ctx, preview.operations)
    const reverseOperations = await this.buildReverseOperationsForApply(ctx, preview.operations)
    const authority = this.requireMigrationAuthority()
    const migrationId = generateId('migration')
    const now = new Date()
    const record: SchemaMigrationRecord = {
      id: migrationId,
      organizationId: orgId,
      checksum: preview.checksum,
      adapter: preview.adapter,
      description: migrationDescription(preview, input.idempotencyKey),
      entityType: entityTypeForSummary(input.operations[0]!) ?? null,
      operationType: operationTypeForRecord(input.operations),
      forwardOperations: preview.operations,
      reverseOperations,
      destructive: preview.destructive,
      status: 'pending',
      sqlStatements: [],
      rollbackStatements: [],
      appliedBy: ctx.userId ?? null,
      appliedByUserId: null,
      approvedByUserId: null,
      startedAt: null,
      appliedAt: null,
      rolledBackAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }

    const target = operationTarget(preview.operations[0]!)
    return this.ledger.withMigrationLock(ctx, { adapter: preview.adapter, target }, async () => {
      await this.ledger.create(ctx, record)
      await this.ledger.updateStatus(ctx, migrationId, {
        status: 'running',
        startedAt: new Date(),
        appliedBy: ctx.userId ?? null,
      })
      try {
        await authority.run({
          ctx,
          operation: 'apply',
          checksum: preview.checksum,
          migrationId,
        }, async (db) => {
          await this.executeForwardOperations(db, ctx, preview.operations)
        })
        await this.ledger.updateStatus(ctx, migrationId, {
          status: 'applied',
          appliedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        })
        return {
          migrationId,
          checksum: preview.checksum,
          status: 'applied' as const,
          appliedOperations: preview.operations,
          ...rollbackMetadataFor(reverseOperations),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        }
      } catch (error) {
        const failure = sanitizedMigrationFailure('apply', error)
        await this.ledger.updateStatus(ctx, migrationId, {
          status: 'failed',
          failedAt: new Date(),
          errorCode: failure.code,
          errorMessage: failure.message,
        })
        throw migrationExecutionError('apply', error)
      }
    }).then((locked) => locked.result)
  }

  async rollback(
    ctx: OrbitAuthContext,
    migration: string | Record<string, unknown>,
  ): Promise<SchemaMigrationRollbackOutput> {
    const orgId = assertOrgContext(ctx)
    const input = typeof migration === 'string'
      ? schemaMigrationRollbackInputSchema.parse({ migrationId: migration })
      : schemaMigrationRollbackInputSchema.parse(migration)
    const adapter = this.schemaAdapter
    const adapterScope: SchemaMigrationAdapterScope = {
      name: adapter.name,
      dialect: adapter.dialect,
    }
    const record = await this.ledger.assertRollbackPreconditions(ctx, {
      migrationId: input.migrationId,
      adapter: adapterScope,
    })
    this.assertRollbackHasWork(record)
    const rollbackChecksum = computeSchemaMigrationChecksum({
      adapter: adapterScope,
      orgId,
      operations: record.reverseOperations,
    })
    if (input.checksum && input.checksum !== rollbackChecksum) {
      this.destructiveConfirmationStale(rollbackChecksum, input.checksum)
    }
    const destructiveOperations = record.reverseOperations
      .filter((operation) => isDestructiveForwardOperation(operation))
      .map((operation) => operation.type)
    assertDestructiveConfirmation({
      destructiveOperations,
      checksum: rollbackChecksum,
      confirmation: input.confirmation,
      runtimeEnvironment: this.destructiveMigrationEnvironment,
      requireRuntimeEnvironment: this.migrationAuthority !== undefined,
    })
    const authority = this.requireMigrationAuthority()
    if (record.forwardOperations.length > 1 || record.reverseOperations.length > 1) {
      this.unsupportedMigrationOperation('batch schema migration rollback requires multi-target locking')
    }
    const target = operationTarget(record.forwardOperations[0]!)
    return this.ledger.withMigrationLock(ctx, { adapter: adapterScope, target }, async () => {
      try {
        await authority.run({
          ctx,
          operation: 'rollback',
          migrationId: input.migrationId,
          checksum: rollbackChecksum,
        }, async (db) => {
          await this.executeForwardOperations(db, ctx, record.reverseOperations, 'rollback')
        })
        await this.ledger.updateStatus(ctx, input.migrationId, {
          status: 'rolled_back',
          rolledBackAt: new Date(),
          errorCode: null,
          errorMessage: null,
        })
        return {
          migrationId: input.migrationId,
          rolledBackMigrationId: input.migrationId,
          checksum: rollbackChecksum,
          status: 'rolled_back' as const,
          operations: record.reverseOperations,
        }
      } catch (error) {
        const failure = sanitizedMigrationFailure('rollback', error)
        await this.ledger.updateStatus(ctx, input.migrationId, {
          status: 'applied',
          failedAt: new Date(),
          errorCode: failure.code,
          errorMessage: failure.message,
        })
        throw migrationExecutionError('rollback', error)
      }
    }).then((locked) => locked.result)
  }

  private async findExistingApplyMigration(
    ctx: OrbitAuthContext,
    input: SchemaMigrationApplyInput,
    preview: SchemaMigrationPreviewOutput,
  ): Promise<ExistingApplyMigrationMatch | null> {
    const records = await this.listAllSchemaMigrations(ctx)
    const matchingKey = input.idempotencyKey
      ? records.find((record) => recordHasIdempotencyKey(record, input.idempotencyKey!))
      : undefined
    if (matchingKey && matchingKey.checksum !== preview.checksum) {
      this.idempotencyConflict(input.idempotencyKey!)
    }
    if (matchingKey?.status === 'applied') return { record: matchingKey, matchedBy: 'idempotencyKey' }

    const matchingChecksum = records.find((record) =>
      record.status === 'applied' &&
      record.checksum === preview.checksum &&
      record.adapter.name === preview.adapter.name &&
      record.adapter.dialect === preview.adapter.dialect
    )
    return matchingChecksum ? { record: matchingChecksum, matchedBy: 'checksum' } : null
  }

  private async executeForwardOperations(
    db: MigrationDatabase,
    ctx: OrbitAuthContext,
    operations: SchemaMigrationForwardOperation[],
    phase: SchemaMigrationAuthorityOperation = 'apply',
  ): Promise<void> {
    for (const operation of operations) {
      await this.executeForwardOperation(db, ctx, operation, phase)
    }
  }

  private async executeForwardOperation(
    db: MigrationDatabase,
    ctx: OrbitAuthContext,
    operation: SchemaMigrationForwardOperation,
    phase: SchemaMigrationAuthorityOperation,
  ): Promise<void> {
    switch (operation.type) {
      case 'custom_field.add':
        await executeCustomFieldAdd(db, assertOrgContext(ctx), operation)
        return
      case 'custom_field.delete':
        await executeCustomFieldDelete(db, assertOrgContext(ctx), operation, this.schemaAdapter.dialect)
        return
      case 'custom_field.rename':
        await executeCustomFieldRename(db, assertOrgContext(ctx), operation, this.schemaAdapter.dialect)
        return
      case 'custom_field.update':
      case 'custom_field.promote':
      case 'column.add':
      case 'column.drop':
      case 'column.rename':
      case 'index.add':
      case 'index.drop':
        this.unsupportedMigrationOperation(operation.type)
      case 'adapter.semantic':
        this.unsupportedMigrationOperation(`adapter.semantic:${operation.operation}`)
    }
  }

  private async assertApplyOperationPreconditions(
    ctx: OrbitAuthContext,
    operations: SchemaMigrationForwardOperation[],
  ): Promise<void> {
    for (const operation of operations) {
      switch (operation.type) {
        case 'custom_field.delete': {
          this.tableForExtensibleEntity(operation.entityType)
          const existing = await this.findCustomField(ctx, operation.entityType, operation.fieldName)
          if (!existing) {
            this.validationFailed(
              `Custom field ${operation.entityType}.${operation.fieldName} does not exist`,
              'fieldName',
            )
          }
          break
        }
        case 'custom_field.rename': {
          this.tableForExtensibleEntity(operation.entityType)
          const existing = await this.findCustomField(ctx, operation.entityType, operation.fieldName)
          const conflict = await this.findCustomField(ctx, operation.entityType, operation.newFieldName)
          if (!existing) {
            this.validationFailed(
              `Custom field ${operation.entityType}.${operation.fieldName} does not exist`,
              'fieldName',
            )
          }
          if (conflict) {
            throw createOrbitError({
              code: 'CONFLICT',
              message: `Custom field '${operation.newFieldName}' already exists for entity type '${operation.entityType}' in this organization`,
              field: 'newFieldName',
            })
          }
          break
        }
        case 'custom_field.update':
        case 'custom_field.promote':
          this.tableForExtensibleEntity(operation.entityType)
          break
        default:
          break
      }
    }
  }

  private assertRollbackHasWork(record: SchemaMigrationRecord): void {
    if (record.reverseOperations.length === 0) {
      this.unsupportedMigrationOperation(
        `schema migration rollback:${record.id} has no reversible operations`,
      )
    }
  }

  private tableForExtensibleEntity(entityType: string): string {
    const table = EXTENSIBLE_ENTITY_TABLES[entityType as keyof typeof EXTENSIBLE_ENTITY_TABLES]
    if (!table) {
      this.unsupportedCustomFieldEntity(entityType)
    }
    return table
  }

  private async findCustomField(
    ctx: OrbitAuthContext,
    entityType: string,
    fieldName: string,
  ): Promise<CustomFieldDefinitionRecord | null> {
    const result = await this.repository.list(ctx, {
      limit: 2,
      filter: {
        entity_type: entityType,
        field_name: fieldName,
      },
    })
    return result.data[0] ?? null
  }

  private async buildReverseOperationsForApply(
    _ctx: OrbitAuthContext,
    operations: SchemaMigrationForwardOperation[],
  ): Promise<SchemaMigrationForwardOperation[]> {
    const reverse: SchemaMigrationForwardOperation[] = []
    for (const operation of [...operations].reverse()) {
      const reverseOperation = reverseOperationFor(operation)
      if (reverseOperation) reverse.push(reverseOperation)
    }
    return reverse
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
    const input = schemaMigrationUpdateFieldRequestInputSchema.parse(data)
    const { confirmation: _confirmation, ...patch } = input
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.update',
      entityType,
      fieldName,
      patch,
    }]
    const preview = await this.preview(ctx, { operations })
    if (preview.destructive) {
      return this.apply(ctx, {
        operations,
        checksum: preview.checksum,
        ...(_confirmation ? { confirmation: _confirmation } : {}),
      })
    }

    this.tableForExtensibleEntity(entityType)
    const existing = await this.findCustomField(ctx, entityType, fieldName)
    if (!existing) {
      this.validationFailed(`Custom field ${entityType}.${fieldName} does not exist`, 'fieldName')
    }
    const updated = await this.repository.update(ctx, existing.id, toCustomFieldDefinitionPatch(patch))
    if (!updated) {
      this.validationFailed(`Custom field ${entityType}.${fieldName} does not exist`, 'fieldName')
    }
    return updated
  }

  async deleteField(
    ctx: OrbitAuthContext,
    entityType: string,
    fieldName: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const orgId = assertOrgContext(ctx)
    const input = schemaMigrationDeleteFieldInputSchema.parse({
      entityType,
      fieldName,
      confirmation: data.confirmation,
    })
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(input.entityType as PublicCrmEntityType)) {
      this.validationFailed(`Unknown entity type: ${input.entityType}`, 'entityType')
    }
    this.tableForExtensibleEntity(input.entityType)
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: input.entityType,
      fieldName: input.fieldName,
    }]
    const adapter = this.schemaAdapter
    const checksum = computeSchemaMigrationChecksum({
      adapter: {
        name: adapter.name,
        dialect: adapter.dialect,
      },
      orgId,
      operations,
    })
    assertDestructiveConfirmation({
      destructiveOperations: operations.map((operation) => operation.type),
      checksum,
      confirmation: input.confirmation,
      runtimeEnvironment: this.destructiveMigrationEnvironment,
    })
    await this.apply(ctx, {
      operations,
      checksum,
      confirmation: input.confirmation,
    })
  }
}

interface PreviewClassificationContext {
  adapter: SchemaEngineSchemaAdapter
  customFields: Map<string, CustomFieldEvidence>
  ledger: PreviewLedgerState
  snapshot: SchemaSnapshot
  warnings: string[]
}

interface ExistingApplyMigrationMatch {
  record: SchemaMigrationRecord
  matchedBy: 'idempotencyKey' | 'checksum'
}

interface CustomFieldEvidence {
  id: string
  organizationId: string
  entityType: string
  fieldName: string
  fieldType: CustomFieldDefinition['fieldType']
  label: string
  description?: string | null
  isRequired: boolean
  isIndexed: boolean
  isPromoted: boolean
  promotedColumnName?: string | null
  defaultValue?: unknown
  options: string[]
  validation: Record<string, unknown>
}

interface PreviewLedgerState {
  appliedCustomFieldAdds: Set<string>
  appliedCustomFieldDependencies: Set<string>
  runningMigrationCount: number
  runningTargets: Set<string>
}

function mergeCustomFieldSources(
  orgId: string,
  snapshotFields: CustomFieldDefinition[],
  repositoryFields: CustomFieldDefinitionRecord[],
): Map<string, CustomFieldEvidence> {
  const fields = new Map<string, CustomFieldEvidence>()
  for (const field of snapshotFields) {
    if (field.organizationId === orgId) {
      fields.set(customFieldKey(field.entityType, field.fieldName), toCustomFieldEvidence(field))
    }
  }
  for (const field of repositoryFields) {
    const key = customFieldKey(field.entityType, field.fieldName)
    const existing = fields.get(key)
    const evidence = toCustomFieldEvidence(field)
    fields.set(key, existing ? mergeCustomFieldEvidence(existing, evidence) : evidence)
  }
  return fields
}

function toCustomFieldEvidence(field: CustomFieldDefinition | CustomFieldDefinitionRecord): CustomFieldEvidence {
  const evidence: CustomFieldEvidence = {
    id: field.id,
    organizationId: field.organizationId,
    entityType: field.entityType,
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    label: field.label,
    isRequired: field.isRequired,
    isIndexed: field.isIndexed,
    isPromoted: field.isPromoted,
    options: field.options,
    validation: field.validation,
  }
  if ('description' in field) {
    evidence.description = field.description ?? null
  }
  if (field.promotedColumnName !== undefined) {
    evidence.promotedColumnName = field.promotedColumnName
  }
  if (field.defaultValue !== undefined) {
    evidence.defaultValue = field.defaultValue
  }
  return evidence
}

function mergeCustomFieldEvidence(a: CustomFieldEvidence, b: CustomFieldEvidence): CustomFieldEvidence {
  const aDefault = hasNonNullDefaultValue(a) ? a.defaultValue : undefined
  const bDefault = hasNonNullDefaultValue(b) ? b.defaultValue : undefined
  const promotedColumnName = a.promotedColumnName ?? b.promotedColumnName
  const defaultValue = aDefault ?? bDefault ?? b.defaultValue ?? a.defaultValue
  const fieldType = a.isPromoted ? a.fieldType : b.fieldType
  const merged: CustomFieldEvidence = {
    ...a,
    ...b,
    fieldType,
    isRequired: a.isRequired || b.isRequired,
    isIndexed: a.isIndexed || b.isIndexed,
    isPromoted: a.isPromoted || b.isPromoted,
  }
  if (promotedColumnName !== undefined) {
    merged.promotedColumnName = promotedColumnName
  }
  if (defaultValue !== undefined) {
    merged.defaultValue = defaultValue
  }
  return merged
}

function customFieldKey(entityType: string, fieldName: string): string {
  return `${entityType}.${fieldName}`
}

function buildPreviewLedgerState(
  records: SchemaMigrationRecord[],
  adapter: SchemaMigrationAdapterScope,
): PreviewLedgerState {
  const state: PreviewLedgerState = {
    appliedCustomFieldAdds: new Set(),
    appliedCustomFieldDependencies: new Set(),
    runningMigrationCount: 0,
    runningTargets: new Set(),
  }

  for (const record of records) {
    if (record.adapter.name !== adapter.name || record.adapter.dialect !== adapter.dialect) {
      continue
    }
    if (record.status === 'running') {
      state.runningMigrationCount += 1
      for (const operation of record.forwardOperations) {
        state.runningTargets.add(operationTarget(operation))
      }
      continue
    }
    if (record.status !== 'applied') {
      continue
    }
    for (const operation of record.forwardOperations) {
      if (
        operation.type === 'custom_field.add' ||
        operation.type === 'custom_field.update' ||
        operation.type === 'custom_field.delete' ||
        operation.type === 'custom_field.rename' ||
        operation.type === 'custom_field.promote'
      ) {
        const key = customFieldKey(operation.entityType, operation.fieldName)
        state.appliedCustomFieldDependencies.add(key)
        if (operation.type === 'custom_field.add') {
          state.appliedCustomFieldAdds.add(key)
        }
      }
      if (operation.type === 'custom_field.rename') {
        state.appliedCustomFieldDependencies.add(customFieldKey(operation.entityType, operation.newFieldName))
      }
    }
  }

  return state
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
  if (classifyLedgerRisk(operation, context).destructive) {
    return { destructive: true }
  }

  if (DESTRUCTIVE_PREVIEW_OPERATION_TYPES.has(operation.type)) {
    warnIfMissingCustomField(operation, context)
    return { destructive: true }
  }

  switch (operation.type) {
    case 'custom_field.add':
      if (context.customFields.has(customFieldKey(operation.entityType, operation.fieldName))) {
        context.warnings.push(
          `Custom field ${operation.entityType}.${operation.fieldName} already exists in metadata or adapter snapshot; adding it again is conflict-prone.`,
        )
        return { destructive: true }
      }
      if (operation.required === true && operation.defaultValue === undefined) {
        context.warnings.push(
          `Adding required custom field ${operation.entityType}.${operation.fieldName} without a default can invalidate existing records.`,
        )
        return { destructive: true }
      }
      if (operation.indexed === true && !context.adapter.supportsJsonbIndexes) {
        context.warnings.push(
          `Adapter ${context.adapter.name} has not proven JSONB custom-field index support.`,
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

function classifyLedgerRisk(
  operation: SchemaMigrationPublicForwardOperation,
  context: PreviewClassificationContext,
): { destructive: boolean } {
  const target = operationTarget(operation)
  if (context.ledger.runningTargets.has(target)) {
    context.warnings.push(
      `A running schema migration already targets ${target}; applying another operation there is conflict-prone.`,
    )
    return { destructive: true }
  }

  const key = customFieldOperationKey(operation)
  if (!key) {
    return { destructive: false }
  }

  if (operation.type === 'custom_field.add' && context.ledger.appliedCustomFieldAdds.has(key)) {
    context.warnings.push(
      `Applied migration history already includes custom field ${key}; adding it again is redundant or conflicting.`,
    )
    return { destructive: true }
  }

  if (operation.type === 'custom_field.update' && context.ledger.appliedCustomFieldDependencies.has(key)) {
    const updateRisk = classifyCustomFieldUpdate(operation, context)
    if (!updateRisk.destructive) {
      return { destructive: false }
    }
    context.warnings.push(
      `Applied migration history includes prior changes for custom field ${key}; this operation depends on migration history.`,
    )
    return { destructive: true }
  }

  if (operation.type !== 'custom_field.add' && context.ledger.appliedCustomFieldDependencies.has(key)) {
    context.warnings.push(
      `Applied migration history includes prior changes for custom field ${key}; this operation depends on migration history.`,
    )
    return { destructive: true }
  }

  return { destructive: false }
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

  if (
    hasOwnProperty(operation.patch, 'defaultValue') &&
    operation.patch.defaultValue === null &&
    existing.isRequired &&
    hasNonNullDefaultValue(existing)
  ) {
    context.warnings.push(
      `Removing the default from required custom field ${operation.entityType}.${operation.fieldName} can invalidate future records.`,
    )
    return { destructive: true }
  }

  if (operation.patch.fieldType && operation.patch.fieldType !== existing.fieldType) {
    if (isCompatibleCustomFieldWidening(existing.fieldType, operation.patch.fieldType)) {
      if (existing.isPromoted) {
        context.warnings.push(
          `Changing promoted custom field ${operation.entityType}.${operation.fieldName} from ${existing.fieldType} to ${operation.patch.fieldType} requires physical column migration.`,
        )
        return { destructive: true }
      }
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

function hasOwnProperty<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function hasNonNullDefaultValue(
  field: CustomFieldEvidence,
): boolean {
  return field.defaultValue !== undefined && field.defaultValue !== null
}

function customFieldOperationKey(operation: SchemaMigrationPublicForwardOperation): string | null {
  switch (operation.type) {
    case 'custom_field.add':
    case 'custom_field.update':
    case 'custom_field.delete':
    case 'custom_field.rename':
    case 'custom_field.promote':
      return customFieldKey(operation.entityType, operation.fieldName)
    default:
      return null
  }
}

function operationTarget(operation: SchemaMigrationForwardOperation): string {
  switch (operation.type) {
    case 'custom_field.add':
    case 'custom_field.update':
    case 'custom_field.delete':
    case 'custom_field.rename':
    case 'custom_field.promote':
      return `custom_field:${operation.entityType}.${operation.fieldName}`
    case 'column.add':
    case 'column.drop':
    case 'column.rename':
      return `table:${operation.tableName}`
    case 'index.add':
    case 'index.drop':
      return `table:${operation.tableName}`
    case 'adapter.semantic':
      return `adapter:${operation.operation}`
  }
}

function isDestructiveForwardOperation(operation: SchemaMigrationForwardOperation): boolean {
  return DESTRUCTIVE_PREVIEW_OPERATION_TYPES.has(operation.type)
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

function buildReverseOperations(
  operations: SchemaMigrationForwardOperation[],
): SchemaMigrationForwardOperation[] {
  const reverse: SchemaMigrationForwardOperation[] = []
  for (const operation of [...operations].reverse()) {
    const reverseOperation = reverseOperationFor(operation)
    if (reverseOperation) reverse.push(reverseOperation)
  }
  return reverse
}

function reverseOperationFor(
  operation: SchemaMigrationForwardOperation,
): SchemaMigrationForwardOperation | null {
  switch (operation.type) {
    case 'custom_field.add':
      return {
        type: 'custom_field.delete',
        entityType: operation.entityType,
        fieldName: operation.fieldName,
      }
    case 'custom_field.rename':
      return {
        type: 'custom_field.rename',
        entityType: operation.entityType,
        fieldName: operation.newFieldName,
        newFieldName: operation.fieldName,
      }
    case 'column.add':
      return {
        type: 'column.drop',
        tableName: operation.tableName,
        columnName: operation.columnName,
      }
    case 'column.rename':
      return {
        type: 'column.rename',
        tableName: operation.tableName,
        columnName: operation.newColumnName,
        newColumnName: operation.columnName,
      }
    case 'index.add':
      return {
        type: 'index.drop',
        tableName: operation.tableName,
        indexName: operation.indexName,
      }
    case 'custom_field.update':
    case 'custom_field.delete':
    case 'custom_field.promote':
    case 'column.drop':
    case 'index.drop':
    case 'adapter.semantic':
      return null
  }
}

function rollbackMetadataFor(
  reverseOperations: SchemaMigrationForwardOperation[],
): Pick<SchemaMigrationApplyOutput, 'rollbackable' | 'rollbackDecision'> {
  if (reverseOperations.length > 0) {
    return {
      rollbackable: true,
      rollbackDecision: { decision: 'rollbackable' },
    }
  }
  return {
    rollbackable: false,
    rollbackDecision: {
      decision: 'non_rollbackable',
      reason: 'No complete reverse operations are available for this migration.',
    },
  }
}

function operationTypeForRecord(operations: SchemaMigrationPublicForwardOperation[]): string {
  if (operations.length !== 1) return 'batch'
  const [domain, action] = operations[0]!.type.split('.')
  return `${domain}_${action}`
}

function migrationDescription(
  preview: SchemaMigrationPreviewOutput,
  idempotencyKey: string | undefined,
): string {
  return idempotencyKey
    ? `${preview.summary} ${encodeIdempotencyMarker(idempotencyKey)}`
    : preview.summary
}

function recordHasIdempotencyKey(record: SchemaMigrationRecord, idempotencyKey: string): boolean {
  return parseIdempotencyMarker(record.description) === idempotencyKey
}

function encodeIdempotencyMarker(idempotencyKey: string): string {
  const payload = Buffer.from(JSON.stringify({ idempotencyKey }), 'utf8').toString('base64url')
  return `[orbit-idempotency:${payload}]`
}

function parseIdempotencyMarker(description: string): string | null {
  const marker = description.match(/\[orbit-idempotency:([A-Za-z0-9_-]+)\]$/)
  if (!marker) return null
  try {
    const parsed = JSON.parse(Buffer.from(marker[1]!, 'base64url').toString('utf8')) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'idempotencyKey' in parsed &&
      typeof parsed.idempotencyKey === 'string'
    ) {
      return parsed.idempotencyKey
    }
  } catch {
    return null
  }
  return null
}

function customFieldRecordFromAddOperation(
  orgId: string,
  operation: Extract<SchemaMigrationForwardOperation, { type: 'custom_field.add' }>,
): CustomFieldDefinitionRecord {
  const now = new Date()
  return {
    id: generateId('customField'),
    organizationId: orgId,
    entityType: operation.entityType,
    fieldName: operation.fieldName,
    fieldType: operation.fieldType,
    label: operation.label ?? operation.fieldName,
    description: operation.description ?? null,
    isRequired: operation.required ?? false,
    isIndexed: operation.indexed ?? false,
    isPromoted: false,
    promotedColumnName: null,
    defaultValue: operation.defaultValue ?? null,
    options: operation.options ?? [],
    validation: operation.validation ?? {},
    createdAt: now,
    updatedAt: now,
  }
}

function toCustomFieldDefinitionPatch(
  patch: Extract<SchemaMigrationPublicForwardOperation, { type: 'custom_field.update' }>['patch'],
): Partial<CustomFieldDefinitionRecord> {
  return {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.fieldType !== undefined ? { fieldType: patch.fieldType } : {}),
    ...(patch.required !== undefined ? { isRequired: patch.required } : {}),
    ...(patch.indexed !== undefined ? { isIndexed: patch.indexed } : {}),
    ...(patch.defaultValue !== undefined ? { defaultValue: patch.defaultValue } : {}),
    ...(patch.options !== undefined ? { options: patch.options } : {}),
    ...(patch.validation !== undefined ? { validation: patch.validation } : {}),
    updatedAt: new Date(),
  }
}

async function executeCustomFieldAdd(
  db: MigrationDatabase,
  orgId: string,
  operation: Extract<SchemaMigrationForwardOperation, { type: 'custom_field.add' }>,
): Promise<void> {
  const record = customFieldRecordFromAddOperation(orgId, operation)
  await db.execute(sql`
    insert into custom_field_definitions (
      id,
      organization_id,
      entity_type,
      field_name,
      field_type,
      label,
      description,
      is_required,
      is_indexed,
      is_promoted,
      promoted_column_name,
      default_value,
      options,
      validation,
      created_at,
      updated_at
    ) values (
      ${record.id},
      ${record.organizationId},
      ${record.entityType},
      ${record.fieldName},
      ${record.fieldType},
      ${record.label},
      ${record.description},
      ${record.isRequired},
      ${record.isIndexed},
      ${record.isPromoted},
      ${record.promotedColumnName},
      ${record.defaultValue === null ? null : JSON.stringify(record.defaultValue)},
      ${JSON.stringify(record.options)},
      ${JSON.stringify(record.validation)},
      ${record.createdAt.toISOString()},
      ${record.updatedAt.toISOString()}
    )
  `)
}

async function executeCustomFieldDelete(
  db: MigrationDatabase,
  orgId: string,
  operation: Extract<SchemaMigrationForwardOperation, { type: 'custom_field.delete' }>,
  dialect: SchemaEngineSchemaAdapter['dialect'],
): Promise<void> {
  const tableName = tableNameForCustomFieldOperation(operation.entityType)
  await db.transaction(async (tx) => {
    await tx.execute(customFieldValueDeleteStatement(dialect, tableName, orgId, operation.fieldName))
    await tx.execute(sql`
      delete from custom_field_definitions
      where organization_id = ${orgId}
        and entity_type = ${operation.entityType}
        and field_name = ${operation.fieldName}
    `)
  })
}

async function executeCustomFieldRename(
  db: MigrationDatabase,
  orgId: string,
  operation: Extract<SchemaMigrationForwardOperation, { type: 'custom_field.rename' }>,
  dialect: SchemaEngineSchemaAdapter['dialect'],
): Promise<void> {
  const tableName = tableNameForCustomFieldOperation(operation.entityType)
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update custom_field_definitions
      set field_name = ${operation.newFieldName},
          updated_at = ${new Date().toISOString()}
      where organization_id = ${orgId}
        and entity_type = ${operation.entityType}
        and field_name = ${operation.fieldName}
    `)
    await tx.execute(customFieldValueRenameStatement(
      dialect,
      tableName,
      orgId,
      operation.fieldName,
      operation.newFieldName,
    ))
  })
}

function tableNameForCustomFieldOperation(entityType: string): string {
  const tableName = EXTENSIBLE_ENTITY_TABLES[entityType as keyof typeof EXTENSIBLE_ENTITY_TABLES]
  if (!tableName) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: `Entity type '${entityType}' does not support custom field value storage`,
      field: 'entityType',
    })
  }
  return tableName
}

function customFieldValueDeleteStatement(
  dialect: SchemaEngineSchemaAdapter['dialect'],
  tableName: string,
  orgId: string,
  fieldName: string,
) {
  if (dialect === 'postgres') {
    return sql`
      update ${sql.raw(tableName)}
      set custom_fields = custom_fields - ${fieldName},
          updated_at = now()
      where organization_id = ${orgId}
        and custom_fields ? ${fieldName}
    `
  }

  return sql`
    update ${sql.raw(tableName)}
    set custom_fields = json_remove(coalesce(custom_fields, '{}'), ${sqliteJsonPath(fieldName)}),
        updated_at = ${new Date().toISOString()}
    where organization_id = ${orgId}
      and json_type(coalesce(custom_fields, '{}'), ${sqliteJsonPath(fieldName)}) is not null
  `
}

function customFieldValueRenameStatement(
  dialect: SchemaEngineSchemaAdapter['dialect'],
  tableName: string,
  orgId: string,
  oldFieldName: string,
  newFieldName: string,
) {
  if (dialect === 'postgres') {
    return sql`
      update ${sql.raw(tableName)}
      set custom_fields = (custom_fields - ${oldFieldName}::text) || jsonb_build_object(${newFieldName}::text, custom_fields -> ${oldFieldName}::text),
          updated_at = now()
      where organization_id = ${orgId}
        and custom_fields ? ${oldFieldName}::text
    `
  }

  return sql`
    update ${sql.raw(tableName)}
    set custom_fields = json_set(
          json_remove(coalesce(custom_fields, '{}'), ${sqliteJsonPath(oldFieldName)}),
          ${sqliteJsonPath(newFieldName)},
          json_extract(coalesce(custom_fields, '{}'), ${sqliteJsonPath(oldFieldName)})
        ),
        updated_at = ${new Date().toISOString()}
    where organization_id = ${orgId}
      and json_type(coalesce(custom_fields, '{}'), ${sqliteJsonPath(oldFieldName)}) is not null
  `
}

function sqliteJsonPath(fieldName: string): string {
  return `$."${fieldName.replaceAll('"', '\\"')}"`
}

function sanitizedMigrationFailure(
  phase: 'apply' | 'rollback',
  error: unknown,
): { code: 'MIGRATION_FAILED' | 'MIGRATION_OPERATION_UNSUPPORTED', message: string, causeCode: string } {
  const causeCode = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'INTERNAL_ERROR'
  const code = causeCode === 'MIGRATION_OPERATION_UNSUPPORTED'
    ? 'MIGRATION_OPERATION_UNSUPPORTED'
    : 'MIGRATION_FAILED'
  return {
    code,
    message: `Schema migration failed (phase=${phase}; causeCode=${causeCode})`,
    causeCode,
  }
}

function migrationExecutionError(phase: 'apply' | 'rollback', error: unknown) {
  const failure = sanitizedMigrationFailure(phase, error)
  return createOrbitError({
    code: failure.code,
    message: failure.message,
    retryable: false,
    details: {
      phase,
      causeCode: failure.causeCode,
    },
  })
}
