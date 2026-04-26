import { describe, expect, it, vi } from 'vitest'
import { OrbitSchemaEngine, type SchemaEngineSchemaAdapter, type SchemaMigrationAuthority } from './engine.js'
import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'
import type { SchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import type { SchemaMigrationRecord } from '../entities/schema-migrations/validators.js'
import { OrbitError } from '../types/errors.js'
import {
  computeSchemaMigrationChecksum,
  type DestructiveMigrationEnvironment,
  type SchemaMigrationAdapterScope,
  type SchemaMigrationForwardOperation,
  type SchemaMigrationPublicForwardOperation,
} from './migrations.js'

const ctx: OrbitAuthContext = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY', scopes: ['*'] }
const betaCtx: OrbitAuthContext = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ', scopes: ['*'] }

function field(
  id: string,
  fieldName: string,
  organizationId = ctx.orgId,
  overrides: Partial<CustomFieldDefinitionRecord> = {},
): CustomFieldDefinitionRecord {
  const now = new Date('2026-04-24T00:00:00.000Z')
  return {
    id,
    organizationId,
    entityType: 'contacts',
    fieldName,
    fieldType: 'text',
    label: fieldName,
    description: null,
    isRequired: false,
    isIndexed: false,
    isPromoted: false,
    promotedColumnName: null,
    defaultValue: null,
    options: [],
    validation: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function ledger(): SchemaMigrationRepository {
  return {
    async create(_ctx, record) {
      return record
    },
    async get() {
      return null
    },
    async list() {
      return { data: [], hasMore: false, nextCursor: null }
    },
    async updateStatus() {
      return null
    },
    async assertRollbackPreconditions() {
      throw new Error('not needed in schema engine boundary tests')
    },
    async withMigrationLock(_ctx, scope, fn) {
      return {
        result: await fn(),
        lock: {
          key: 'test-lock',
          orgId: ctx.orgId,
          adapter: scope.adapter,
          target: scope.target,
          acquired: true,
          contended: false,
          released: true,
          acquiredAt: new Date('2026-04-24T00:00:00.000Z'),
          releasedAt: new Date('2026-04-24T00:00:00.000Z'),
        },
      }
    },
  }
}

function trackingLedger(records: SchemaMigrationRecord[] = []) {
  const repository: SchemaMigrationRepository = {
    create: vi.fn(async (_ctx, record) => record),
    get: vi.fn(async () => null),
    list: vi.fn(async () => ({ data: records, hasMore: false, nextCursor: null })),
    updateStatus: vi.fn(async () => null),
    assertRollbackPreconditions: vi.fn(async () => {
      throw new Error('not needed in schema engine preview tests')
    }),
    withMigrationLock: vi.fn(async (_ctx, scope, fn) => ({
      result: await fn(),
      lock: {
        key: 'test-lock',
        orgId: ctx.orgId,
        adapter: scope.adapter,
        target: scope.target,
        acquired: true,
        contended: false,
        released: true,
        acquiredAt: new Date('2026-04-24T00:00:00.000Z'),
        releasedAt: new Date('2026-04-24T00:00:00.000Z'),
      },
    })),
  }

  return repository
}

function pagedTrackingLedger(pages: Array<{ data: SchemaMigrationRecord[], nextCursor: string | null }>) {
  let index = 0
  const repository: SchemaMigrationRepository = {
    create: vi.fn(async (_ctx, record) => record),
    get: vi.fn(async () => null),
    list: vi.fn(async () => {
      const page = pages[index] ?? { data: [], nextCursor: null }
      index += 1
      return {
        data: page.data,
        hasMore: page.nextCursor !== null,
        nextCursor: page.nextCursor,
      }
    }),
    updateStatus: vi.fn(async () => null),
    assertRollbackPreconditions: vi.fn(async () => {
      throw new Error('not needed in schema engine preview tests')
    }),
    withMigrationLock: vi.fn(async (_ctx, scope, fn) => ({
      result: await fn(),
      lock: {
        key: 'test-lock',
        orgId: ctx.orgId,
        adapter: scope.adapter,
        target: scope.target,
        acquired: true,
        contended: false,
        released: true,
        acquiredAt: new Date('2026-04-24T00:00:00.000Z'),
        releasedAt: new Date('2026-04-24T00:00:00.000Z'),
      },
    })),
  }

  return repository
}

function migrationRecord(overrides: {
  forwardOperations: SchemaMigrationForwardOperation[]
  status?: SchemaMigrationRecord['status']
  adapter?: SchemaMigrationAdapterScope
  id?: string
}): SchemaMigrationRecord {
  const adapter = overrides.adapter ?? { name: 'sqlite', dialect: 'sqlite' }
  const forwardOperations = overrides.forwardOperations
  const now = new Date('2026-04-24T00:00:00.000Z')

  return {
    id: overrides.id ?? 'migration_01J00000000000000000000000',
    organizationId: ctx.orgId,
    checksum: computeSchemaMigrationChecksum({
      adapter,
      orgId: ctx.orgId,
      operations: forwardOperations,
    }),
    adapter,
    description: 'Test schema migration',
    entityType: 'contacts',
    operationType: 'custom_field',
    forwardOperations,
    reverseOperations: [],
    destructive: false,
    status: overrides.status ?? 'applied',
    sqlStatements: [],
    rollbackStatements: [],
    appliedByUserId: null,
    appliedBy: null,
    approvedByUserId: null,
    startedAt: now,
    appliedAt: overrides.status === 'running' ? null : now,
    rolledBackAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  } as SchemaMigrationRecord
}

function makeEngine(
  customFields: CustomFieldDefinitionRepository,
  migrationAuthority?: SchemaMigrationAuthority,
  migrationLedger: SchemaMigrationRepository = ledger(),
  adapter?: SchemaEngineSchemaAdapter,
  destructiveMigrationEnvironment?: DestructiveMigrationEnvironment,
): OrbitSchemaEngine {
  return new OrbitSchemaEngine({
    customFields: () => customFields,
    ledger: () => migrationLedger,
    ...(adapter ? { adapter: () => adapter } : {}),
    ...(migrationAuthority ? { migrationAuthority } : {}),
    ...(destructiveMigrationEnvironment ? { destructiveMigrationEnvironment } : {}),
  })
}

function checksumFor(operations: SchemaMigrationPublicForwardOperation[]): string {
  return computeSchemaMigrationChecksum({
    adapter: { name: 'sqlite', dialect: 'sqlite' },
    orgId: ctx.orgId,
    operations,
  })
}

function makeAuthority() {
  const run = vi.fn(async <T>(
    _context: Parameters<SchemaMigrationAuthority['run']>[0],
    fn: Parameters<SchemaMigrationAuthority['run']>[1],
  ): Promise<T> => {
    return fn({} as Parameters<Parameters<SchemaMigrationAuthority['run']>[1]>[0])
  })
  return { run }
}

const APPLY_OPERATIONS: SchemaMigrationPublicForwardOperation[] = [{
  type: 'custom_field.add',
  entityType: 'contacts',
  fieldName: 'linkedin_url',
  fieldType: 'url',
}]
const APPLY_INPUT = {
  operations: APPLY_OPERATIONS,
  checksum: checksumFor(APPLY_OPERATIONS),
}
const DESTRUCTIVE_APPLY_OPERATIONS: SchemaMigrationPublicForwardOperation[] = [{
  type: 'column.drop',
  tableName: 'contacts',
  columnName: 'legacy_score',
}]
const DESTRUCTIVE_APPLY_INPUT = {
  operations: DESTRUCTIVE_APPLY_OPERATIONS,
  checksum: checksumFor(DESTRUCTIVE_APPLY_OPERATIONS),
}
const VALID_DESTRUCTIVE_CONFIRMATION = {
  destructive: true,
  checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
  confirmedAt: '2026-04-26T12:00:00.000Z',
}
const PRODUCTION_DESTRUCTIVE_CONFIRMATION = {
  ...VALID_DESTRUCTIVE_CONFIRMATION,
  safeguards: {
    environment: 'production',
    environmentAcknowledged: true,
  },
}
const PRODUCTION_DESTRUCTIVE_CONFIRMATION_WITH_EVIDENCE = {
  ...VALID_DESTRUCTIVE_CONFIRMATION,
  safeguards: {
    environment: 'production',
    environmentAcknowledged: true,
    backup: {
      kind: 'snapshot',
      evidenceId: 'snapshot_20260426_120000',
      capturedAt: '2026-04-26T12:00:00.000Z',
    },
    ledger: {
      evidenceId: 'audit_01J00000000000000000000000',
      recordedAt: '2026-04-26T12:00:00.000Z',
    },
    rollback: {
      decision: 'non_rollbackable',
      reason: 'Column drop cannot be reversed without restoring from snapshot.',
    },
  },
}

describe('OrbitSchemaEngine', () => {
  it('rejects listObjects without org context before repository access', async () => {
    let listCalls = 0
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        listCalls += 1
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    await expect(makeEngine(repo).listObjects({ orgId: undefined } as any)).rejects.toMatchObject({
      code: 'AUTH_CONTEXT_REQUIRED',
    })
    expect(listCalls).toBe(0)
  })

  it('rejects getObject without org context before repository access', async () => {
    let listCalls = 0
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        listCalls += 1
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    await expect(makeEngine(repo).getObject({ orgId: undefined } as any, 'contacts')).rejects.toMatchObject({
      code: 'AUTH_CONTEXT_REQUIRED',
    })
    expect(listCalls).toBe(0)
  })

  it('follows repository pagination when listing schema objects', async () => {
    const calls: Array<Record<string, unknown>> = []
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list(_ctx, query) {
        calls.push(query)
        if (query.cursor === undefined) {
          return { data: [field('field_01J00000000000000000000000', 'first')], hasMore: true, nextCursor: 'cursor_2' }
        }
        return { data: [field('field_01J00000000000000000000001', 'second')], hasMore: false, nextCursor: null }
      },
    }

    const result = await makeEngine(repo).listObjects(ctx)
    const contacts = result.find((object) => object.type === 'contacts')

    expect(calls).toEqual([{ limit: 500 }, { limit: 500, cursor: 'cursor_2' }])
    expect(contacts?.customFields.map((customField) => customField.fieldName)).toEqual(['first', 'second'])
  })

  it('does not expose beta custom fields in acme listObjects', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list(requestCtx, query) {
        const rows = [
          field('field_01J00000000000000000000002', 'acme_region', ctx.orgId),
          field('field_01J00000000000000000000003', 'linkedin_url', betaCtx.orgId),
        ].filter((record) => record.organizationId === requestCtx.orgId)
        const entityType = query.filter?.entity_type
        return {
          data: typeof entityType === 'string' ? rows.filter((row) => row.entityType === entityType) : rows,
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).listObjects(ctx)
    const contacts = result.find((object) => object.type === 'contacts')
    expect(contacts?.customFields.map((customField) => customField.fieldName)).toEqual(['acme_region'])
  })

  it('does not expose beta custom fields in acme getObject', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list(requestCtx, query) {
        const rows = [
          field('field_01J00000000000000000000004', 'acme_region', ctx.orgId),
          field('field_01J00000000000000000000005', 'linkedin_url', betaCtx.orgId),
        ].filter((record) => record.organizationId === requestCtx.orgId)
        const entityType = query.filter?.entity_type
        return {
          data: typeof entityType === 'string' ? rows.filter((row) => row.entityType === entityType) : rows,
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const contacts = await makeEngine(repo).getObject(ctx, 'contacts')
    expect(contacts?.customFields.map((customField) => customField.fieldName)).toEqual(['acme_region'])
  })

  it('throws OrbitError validation failures for invalid custom field input', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    await expect(makeEngine(repo).addField(ctx, 'contacts', {})).rejects.toBeInstanceOf(OrbitError)
    await expect(makeEngine(repo).addField(ctx, 'contacts', {})).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'name',
    })
  })

  it('does not call migration authority for reads, preview, or safe addField', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await engine.listObjects(ctx)
    await engine.getObject(ctx, 'contacts')
    await engine.preview(ctx, { operations: [APPLY_INPUT.operations[0]] })
    await engine.addField(ctx, 'contacts', {
      name: 'linkedin_url',
      type: 'url',
    })

    expect(authority.run).not.toHaveBeenCalled()
  })

  it('previews adding a nullable custom field as a non-destructive operation', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
        fieldType: 'url',
      }],
    })

    expect(result).toMatchObject({
      destructive: false,
      confirmationRequired: false,
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      scope: { orgId: ctx.orgId },
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
        fieldType: 'url',
      }],
      confirmationInstructions: {
        required: false,
        destructiveOperations: [],
      },
    })
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(result.summary).toContain('Add linkedin_url custom field to contacts')
  })

  it('previews adding a custom field that already exists in metadata as destructive', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000012', 'tier')],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'tier',
        fieldType: 'text',
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.add'])
    expect(result.warnings).toContain(
      'Custom field contacts.tier already exists in metadata or adapter snapshot; adding it again is conflict-prone.',
    )
  })

  it('previews indexed custom field add as destructive when JSONB indexes are not supported', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
        fieldType: 'url',
        indexed: true,
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.add'])
    expect(result.warnings).toContain('Adapter sqlite has not proven JSONB custom-field index support.')
  })

  it('previews deleting an existing custom field as destructive', async () => {
    const calls: Array<Record<string, unknown>> = []
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list(_ctx, query) {
        calls.push(query)
        return {
          data: query.filter === undefined
            ? [field('field_01J00000000000000000000006', 'legacy_code')]
            : [],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'legacy_code',
      }],
    })

    expect(calls).toEqual([{ limit: 500 }])
    expect(result.warnings).not.toContain('Custom field contacts.legacy_code was not found in metadata or adapter snapshot.')
    expect(result).toMatchObject({
      destructive: true,
      confirmationRequired: true,
      operations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'legacy_code',
      }],
      confirmationInstructions: {
        required: true,
        destructiveOperations: ['custom_field.delete'],
      },
    })
    expect(result.confirmationInstructions.checksum).toBe(result.checksum)
  })

  it('uses applied ledger history to classify duplicate custom field adds as destructive', async () => {
    const migrationLedger = trackingLedger([
      migrationRecord({
        forwardOperations: [{
          type: 'custom_field.add',
          entityType: 'contacts',
          fieldName: 'tier',
          fieldType: 'text',
        }],
      }),
    ])
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    const result = await makeEngine(repo, undefined, migrationLedger).preview(ctx, {
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'tier',
        fieldType: 'text',
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.add'])
    expect(result.warnings).toContain(
      'Applied migration history already includes custom field contacts.tier; adding it again is redundant or conflicting.',
    )
    expect(migrationLedger.create).not.toHaveBeenCalled()
    expect(migrationLedger.updateStatus).not.toHaveBeenCalled()
  })

  it('uses applied ledger history from page 2 to classify duplicate custom field adds as destructive', async () => {
    const relevantMigration = migrationRecord({
      id: 'migration_01J00000000000000000000002',
      forwardOperations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'tier',
        fieldType: 'text',
      }],
    })
    const migrationLedger = pagedTrackingLedger([
      {
        data: [
          migrationRecord({
            id: 'migration_01J00000000000000000000001',
            forwardOperations: [{
              type: 'custom_field.add',
              entityType: 'contacts',
              fieldName: 'unrelated',
              fieldType: 'text',
            }],
          }),
        ],
        nextCursor: 'cursor_2',
      },
      {
        data: [relevantMigration],
        nextCursor: null,
      },
    ])
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    const result = await makeEngine(repo, undefined, migrationLedger).preview(ctx, {
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'tier',
        fieldType: 'text',
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.warnings).toContain(
      'Applied migration history already includes custom field contacts.tier; adding it again is redundant or conflicting.',
    )
    expect(migrationLedger.list).toHaveBeenCalledTimes(2)
    expect(migrationLedger.list).toHaveBeenNthCalledWith(1, ctx, { limit: 100 })
    expect(migrationLedger.list).toHaveBeenNthCalledWith(2, ctx, { limit: 100, cursor: 'cursor_2' })
    expect(migrationLedger.create).not.toHaveBeenCalled()
    expect(migrationLedger.updateStatus).not.toHaveBeenCalled()
  })

  it('uses applied ledger history to classify dependent custom field updates as destructive', async () => {
    const migrationLedger = trackingLedger([
      migrationRecord({
        forwardOperations: [{
          type: 'custom_field.add',
          entityType: 'contacts',
          fieldName: 'tier',
          fieldType: 'text',
        }],
      }),
    ])
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000010', 'tier')],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo, undefined, migrationLedger).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'tier',
        patch: { label: 'Tier' },
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.update'])
    expect(result.warnings).toContain(
      'Applied migration history includes prior changes for custom field contacts.tier; this operation depends on migration history.',
    )
  })

  it('uses running ledger history to classify same-target operations as conflict-prone', async () => {
    const migrationLedger = trackingLedger([
      migrationRecord({
        status: 'running',
        forwardOperations: [{
          type: 'custom_field.update',
          entityType: 'contacts',
          fieldName: 'tier',
          patch: { label: 'Tier' },
        }],
      }),
    ])
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000011', 'tier')],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo, undefined, migrationLedger).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'tier',
        patch: { label: 'Customer Tier' },
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.warnings).toContain('1 schema migration is already running for this organization.')
    expect(result.warnings).toContain(
      'A running schema migration already targets custom_field:contacts.tier; applying another operation there is conflict-prone.',
    )
  })

  it('previews renaming a custom field as destructive', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list(_ctx, query) {
        return {
          data: query.filter?.field_name === 'legacy_code'
            ? [field('field_01J00000000000000000000007', 'legacy_code')]
            : [],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.rename',
        entityType: 'contacts',
        fieldName: 'legacy_code',
        newFieldName: 'customer_code',
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.rename'])
  })

  it('previews unpromoted compatible custom field widening as metadata-only non-destructive', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000008', 'website', ctx.orgId, { fieldType: 'url' })],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'website',
        patch: { fieldType: 'text' },
      }],
    })

    expect(result.destructive).toBe(false)
    expect(result.confirmationRequired).toBe(false)
  })

  it('previews promoted compatible custom field widening as destructive', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [
            field('field_01J00000000000000000000009', 'website', ctx.orgId, {
              fieldType: 'url',
              isPromoted: true,
              promotedColumnName: 'website',
            }),
          ],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'website',
        patch: { fieldType: 'text' },
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.update'])
  })

  it('preserves promoted adapter snapshot evidence when repository metadata is stale', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000013', 'website', ctx.orgId, { fieldType: 'text' })],
          hasMore: false,
          nextCursor: null,
        }
      },
    }
    const adapter: SchemaEngineSchemaAdapter = {
      name: 'sqlite',
      dialect: 'sqlite',
      supportsJsonbIndexes: false,
      async getSchemaSnapshot() {
        return {
          tables: ['contacts'],
          customFields: [{
            id: 'field_01J00000000000000000000013',
            organizationId: ctx.orgId,
            entityType: 'contacts',
            fieldName: 'website',
            fieldType: 'url',
            label: 'Website',
            isRequired: false,
            isIndexed: false,
            isPromoted: true,
            promotedColumnName: 'website',
            options: [],
            validation: {},
          }],
        }
      },
    }

    const result = await makeEngine(repo, undefined, undefined, adapter).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'website',
        patch: { fieldType: 'text' },
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.update'])
    expect(result.warnings).toContain(
      'Changing promoted custom field contacts.website from url to text requires physical column migration.',
    )
  })

  it('previews removing a default from an existing required custom field as destructive', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [
            field('field_01J00000000000000000000014', 'tier', ctx.orgId, {
              isRequired: true,
              defaultValue: 'standard',
            }),
          ],
          hasMore: false,
          nextCursor: null,
        }
      },
    }

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'tier',
        patch: { defaultValue: null },
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.update'])
    expect(result.warnings).toContain(
      'Removing the default from required custom field contacts.tier can invalidate future records.',
    )
  })

  it('does not write ledger records or execute migration authority during preview', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    await makeEngine(repo, authority, migrationLedger).preview(ctx, {
      operations: [{
        type: 'column.add',
        tableName: 'contacts',
        columnName: 'nickname',
        columnType: 'text',
        nullable: true,
      }],
    })

    expect(authority.run).not.toHaveBeenCalled()
    expect(migrationLedger.list).toHaveBeenCalledTimes(1)
    expect(migrationLedger.create).not.toHaveBeenCalled()
    expect(migrationLedger.updateStatus).not.toHaveBeenCalled()
    expect(migrationLedger.withMigrationLock).not.toHaveBeenCalled()
  })

  it('sequences tenant-scoped preview reads to avoid overlapping transaction scopes', async () => {
    let customFieldReadInFlight = false
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        customFieldReadInFlight = true
        await Promise.resolve()
        customFieldReadInFlight = false
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const migrationLedger = trackingLedger()
    vi.mocked(migrationLedger.list).mockImplementation(async () => {
      if (customFieldReadInFlight) {
        throw new Error('tenant-scoped reads overlapped')
      }
      return { data: [], hasMore: false, nextCursor: null }
    })

    await expect(makeEngine(repo, undefined, migrationLedger).preview(ctx, {
      operations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
        fieldType: 'url',
      }],
    })).resolves.toMatchObject({
      destructive: false,
    })
  })

  it('throws structured unavailable errors when apply migration authority is missing', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo)

    await expect(engine.apply(ctx, APPLY_INPUT)).rejects.toMatchObject({
      code: 'MIGRATION_AUTHORITY_UNAVAILABLE',
    })
  })

  it('does not enter migration authority for destructive apply operations without confirmation', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, DESTRUCTIVE_APPLY_INPUT)).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('does not enter migration authority for destructive apply operations with stale confirmation checksum', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: {
        destructive: true,
        checksum: 'c'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('enters migration authority for destructive apply operations only after matching confirmation', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: VALID_DESTRUCTIVE_CONFIRMATION,
    })).resolves.toMatchObject({
      checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
      status: 'noop',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(authority.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        operation: 'apply',
        checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
      }),
      expect.any(Function),
    )
  })

  it('ignores caller production environment when runtime environment is omitted', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: PRODUCTION_DESTRUCTIVE_CONFIRMATION,
    })).resolves.toMatchObject({
      checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
      status: 'noop',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('rejects runtime production destructive apply without safeguard evidence even when confirmation omits environment', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority, undefined, undefined, 'production')

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: VALID_DESTRUCTIVE_CONFIRMATION,
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_SAFEGUARDS_REQUIRED',
      details: {
        missingSafeguards: ['environmentAcknowledged', 'backup', 'ledger', 'rollback'],
      },
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('rejects runtime production destructive apply even when caller claims development environment', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority, undefined, undefined, 'production')

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: {
        ...VALID_DESTRUCTIVE_CONFIRMATION,
        safeguards: {
          environment: 'development',
          environmentAcknowledged: true,
        },
      },
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_SAFEGUARDS_REQUIRED',
      details: {
        missingSafeguards: ['backup', 'ledger', 'rollback'],
      },
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('accepts production-like destructive apply only when safeguard evidence is complete', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: PRODUCTION_DESTRUCTIVE_CONFIRMATION_WITH_EVIDENCE,
    })).resolves.toMatchObject({
      checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
      status: 'noop',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('rejects apply when the supplied checksum does not match current adapter, org, and operations', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, {
      operations: APPLY_OPERATIONS,
      checksum: 'a'.repeat(64),
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('uses preview destructive classification before applying required custom field adds', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.add',
      entityType: 'contacts',
      fieldName: 'tier',
      fieldType: 'text',
      required: true,
    }]

    await expect(engine.apply(ctx, {
      operations,
      checksum: checksumFor(operations),
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
      details: {
        destructiveOperations: ['custom_field.add'],
      },
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('calls migration authority with context for non-destructive apply placeholders', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.apply(ctx, APPLY_INPUT)).resolves.toMatchObject({
      checksum: APPLY_INPUT.checksum,
      status: 'noop',
      appliedOperations: [],
    })

    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(authority.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        operation: 'apply',
        checksum: APPLY_INPUT.checksum,
      }),
      expect.any(Function),
    )
  })

  it('rejects destructive rollback placeholders without confirmation before authority or unsupported execution', async () => {
    const authority = makeAuthority()
    const migrationId = 'migration_01J00000000000000000000000'
    const reverseOperations: SchemaMigrationForwardOperation[] = [{
      type: 'column.drop',
      tableName: 'contacts',
      columnName: 'linkedin_url',
    }]
    const migrationLedger = trackingLedger()
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue({
      ...migrationRecord({
        id: migrationId,
        forwardOperations: [{
          type: 'column.add',
          tableName: 'contacts',
          columnName: 'linkedin_url',
          columnType: 'text',
        }],
      }),
      reverseOperations,
    })
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority, migrationLedger)

    await expect(engine.rollback(ctx, migrationId)).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('rejects destructive rollback placeholders without confirmation before missing authority', async () => {
    const migrationId = 'migration_01J00000000000000000000000'
    const reverseOperations: SchemaMigrationForwardOperation[] = [{
      type: 'column.drop',
      tableName: 'contacts',
      columnName: 'linkedin_url',
    }]
    const migrationLedger = trackingLedger()
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue({
      ...migrationRecord({
        id: migrationId,
        forwardOperations: [{
          type: 'column.add',
          tableName: 'contacts',
          columnName: 'linkedin_url',
          columnType: 'text',
        }],
      }),
      reverseOperations,
    })
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, undefined, migrationLedger)

    await expect(engine.rollback(ctx, migrationId)).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
    })
  })

  it('allows destructive rollback placeholders through confirmation gate before rejecting unsupported', async () => {
    const authority = makeAuthority()
    const migrationId = 'migration_01J00000000000000000000000'
    const reverseOperations: SchemaMigrationForwardOperation[] = [{
      type: 'column.drop',
      tableName: 'contacts',
      columnName: 'linkedin_url',
    }]
    const checksum = computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: ctx.orgId,
      operations: reverseOperations,
    })
    const migrationLedger = trackingLedger()
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue({
      ...migrationRecord({
        id: migrationId,
        forwardOperations: [{
          type: 'column.add',
          tableName: 'contacts',
          columnName: 'linkedin_url',
          columnType: 'text',
        }],
      }),
      reverseOperations,
    })
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority, migrationLedger)

    await expect(engine.rollback(ctx, {
      migrationId,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('rejects destructive field placeholders without confirmation before authority or unsupported execution', async () => {
    const authority = makeAuthority()
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', { fieldType: 'number' })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
    })
    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url')).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('rejects destructive field placeholders as unsupported after confirmation without authority execution', async () => {
    const authority = makeAuthority()
    const updateOperations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.update',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
      patch: { fieldType: 'number' },
    }]
    const deleteOperations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000015', 'linkedin_url')],
          hasMore: false,
          nextCursor: null,
        }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', {
      fieldType: 'number',
      confirmation: {
        destructive: true,
        checksum: checksumFor(updateOperations),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url', {
      confirmation: {
        destructive: true,
        checksum: checksumFor(deleteOperations),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('does not let deleteField body override the path target used for confirmation', async () => {
    const authority = makeAuthority()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000016', 'linkedin_url')],
          hasMore: false,
          nextCursor: null,
        }
      },
    }
    const engine = makeEngine(repo, authority)

    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url', {
      entityType: 'companies',
      fieldName: 'other_field',
      confirmation: {
        destructive: true,
        checksum: checksumFor(operations),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })
})
