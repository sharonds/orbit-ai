import type { SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { OrbitSchemaEngine, type SchemaEngineSchemaAdapter, type SchemaMigrationAuthority } from './engine.js'
import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'
import type { SchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import type { SchemaMigrationRecord } from '../entities/schema-migrations/validators.js'
import { OrbitError } from '../types/errors.js'
import { DESTRUCTIVE_CONFIRMATION_TTL_MS } from './destructive-confirmation.js'
import {
  computeSchemaMigrationChecksum,
  schemaMigrationApplyOutputSchema,
  schemaMigrationRollbackOutputSchema,
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

function createInMemoryCustomFieldRepo(
  seedOrOverrides: CustomFieldDefinitionRecord[] | Partial<CustomFieldDefinitionRepository> = [],
): CustomFieldDefinitionRepository {
  const seed = Array.isArray(seedOrOverrides) ? seedOrOverrides : []
  const overrides = Array.isArray(seedOrOverrides) ? {} : seedOrOverrides
  const rows = new Map(seed.map((record) => [record.id, record]))
  const repository: CustomFieldDefinitionRepository = {
    async create(requestCtx, record) {
      if (record.organizationId !== requestCtx.orgId) {
        throw new Error('custom field organization mismatch')
      }
      rows.set(record.id, record)
      return record
    },
    async get(requestCtx, id) {
      const record = rows.get(id)
      return record?.organizationId === requestCtx.orgId ? record : null
    },
    async list(requestCtx, query) {
      const data = [...rows.values()].filter((record) => {
        if (record.organizationId !== requestCtx.orgId) return false
        if (query.filter?.entity_type && record.entityType !== query.filter.entity_type) return false
        if (query.filter?.field_name && record.fieldName !== query.filter.field_name) return false
        return true
      })
      return { data, hasMore: false, nextCursor: null }
    },
    async update(requestCtx, id, patch) {
      const current = rows.get(id)
      if (!current || current.organizationId !== requestCtx.orgId) return null
      const next = { ...current, ...patch } as CustomFieldDefinitionRecord
      rows.set(id, next)
      return next
    },
    async delete(requestCtx, id) {
      const current = rows.get(id)
      if (!current || current.organizationId !== requestCtx.orgId) return false
      rows.delete(id)
      return true
    },
  }

  return { ...repository, ...overrides }
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
} & Partial<SchemaMigrationRecord>): SchemaMigrationRecord {
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

function checksumForAdapter(
  operations: SchemaMigrationPublicForwardOperation[],
  adapter: SchemaMigrationAdapterScope,
): string {
  return computeSchemaMigrationChecksum({
    adapter,
    orgId: ctx.orgId,
    operations,
  })
}

function renderSql(statement: SQL): string {
  return statement.toQuery({
    escapeName: (value) => value,
    escapeParam: (index) => `$${index + 1}`,
    escapeString: (value) => JSON.stringify(value),
    casing: { getColumnCasing: (column) => column },
    inlineParams: false,
    paramStartIndex: { value: 0 },
  }).sql
}

function makeAuthority(db = makeMigrationDb()) {
  const run = vi.fn(async <T>(
    _context: Parameters<SchemaMigrationAuthority['run']>[0],
    fn: Parameters<SchemaMigrationAuthority['run']>[1],
  ): Promise<T> => {
    return fn(db)
  })
  return { run }
}

function makeMigrationDb() {
  const db = {
    transaction: vi.fn(async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db)),
    // SQLite-shaped DML result so fail-closed metadata row-count checks pass
    // by default; individual tests override per-call shapes as needed.
    execute: vi.fn(async () => ({ changes: 1 })),
    query: vi.fn(async () => []),
  }
  return db as unknown as Parameters<Parameters<SchemaMigrationAuthority['run']>[1]>[0]
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
  confirmedAt: new Date().toISOString(),
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
    await expect(makeEngine(repo).addField(ctx, 'contacts', {
      name: 'bad_type',
      type: 'unsupported',
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'type',
    })
    await expect(makeEngine(repo).addField(ctx, 'accounts', {
      name: 'customer_tier',
      type: 'text',
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'entityType',
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

  it('includes a confirmation expiry anchored fifteen minutes after preview time for destructive previews', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return {
          data: [field('field_01J00000000000000000000006', 'legacy_code')],
          hasMore: false,
          nextCursor: null,
        }
      },
    }
    const before = Date.now()

    const result = await makeEngine(repo).preview(ctx, {
      operations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'legacy_code',
      }],
    })

    const after = Date.now()
    expect(result.destructive).toBe(true)
    const expiresAt = result.confirmationInstructions.expiresAt
    expect(typeof expiresAt).toBe('string')
    const expiresAtMs = new Date(expiresAt!).getTime()
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + DESTRUCTIVE_CONFIRMATION_TTL_MS)
    expect(expiresAtMs).toBeLessThanOrEqual(after + DESTRUCTIVE_CONFIRMATION_TTL_MS)
  })

  it('omits the confirmation expiry for non-destructive previews', async () => {
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

    expect(result.destructive).toBe(false)
    expect(result.confirmationInstructions.expiresAt).toBeUndefined()
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

  it('keeps safe metadata updates non-destructive after applied custom field add history', async () => {
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

    expect(result.destructive).toBe(false)
    expect(result.confirmationRequired).toBe(false)
    expect(result.confirmationInstructions.destructiveOperations).toEqual([])
    expect(result.warnings).not.toContain(
      'Applied migration history includes prior changes for custom field contacts.tier; this operation depends on migration history.',
    )
  })

  it('uses applied ledger history to classify destructive custom field updates as history-dependent', async () => {
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
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000010', 'tier'),
    ])

    const result = await makeEngine(repo, undefined, migrationLedger).preview(ctx, {
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'tier',
        patch: { fieldType: 'number' },
      }],
    })

    expect(result.destructive).toBe(true)
    expect(result.confirmationRequired).toBe(true)
    expect(result.confirmationInstructions.destructiveOperations).toEqual(['custom_field.update'])
    expect(result.warnings).toEqual(expect.arrayContaining([
      'Changing custom field contacts.tier from text to number can lose or reject existing data.',
      'Applied migration history includes prior changes for custom field contacts.tier; this operation depends on migration history.',
    ]))
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
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('does not enter migration authority for destructive apply operations with an expired confirmation', async () => {
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
    const expiredConfirmedAt = new Date(Date.now() - DESTRUCTIVE_CONFIRMATION_TTL_MS - 60_000).toISOString()

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: {
        destructive: true,
        checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
        confirmedAt: expiredConfirmedAt,
      },
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
      details: expect.objectContaining({
        checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
        confirmedAt: expiredConfirmedAt,
      }),
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('fails closed for unsupported destructive apply operations after matching confirmation', async () => {
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
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: VALID_DESTRUCTIVE_CONFIRMATION,
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'failed',
      errorCode: 'MIGRATION_OPERATION_UNSUPPORTED',
      errorMessage: expect.stringContaining('phase=apply'),
    }))
    expect(authority.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        operation: 'apply',
        checksum: DESTRUCTIVE_APPLY_INPUT.checksum,
      }),
      expect.any(Function),
    )
  })

  it('fails closed for destructive apply when trusted runtime environment is omitted', async () => {
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
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_SAFEGUARDS_REQUIRED',
      details: {
        missingSafeguards: ['runtimeEnvironment'],
      },
    })
    expect(authority.run).not.toHaveBeenCalled()
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

  it('accepts production-like destructive safeguards before failing unsupported execution', async () => {
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
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'production')

    await expect(engine.apply(ctx, {
      ...DESTRUCTIVE_APPLY_INPUT,
      confirmation: PRODUCTION_DESTRUCTIVE_CONFIRMATION_WITH_EVIDENCE,
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
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
      status: 'applied',
      appliedOperations: APPLY_OPERATIONS,
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

  it('applies a semantic custom field migration with real ledger transitions and idempotent retry', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const records = new Map<string, SchemaMigrationRecord>()
    vi.mocked(migrationLedger.create).mockImplementation(async (_ctx, record) => {
      records.set(record.id, record)
      return record
    })
    vi.mocked(migrationLedger.list).mockImplementation(async () => ({
      data: [...records.values()],
      hasMore: false,
      nextCursor: null,
    }))
    vi.mocked(migrationLedger.updateStatus).mockImplementation(async (_ctx, id, patch) => {
      const record = records.get(id)
      if (!record) return null
      const next = {
        ...record,
        ...patch,
        updatedAt: new Date('2026-04-26T12:00:00.000Z'),
      } as SchemaMigrationRecord
      records.set(id, next)
      return next
    })
    const runtimeDb = {
      execute: vi.fn(),
      query: vi.fn(),
    }
    const repo = createInMemoryCustomFieldRepo({
      async create() {
        throw new Error('runtime repository must not execute schema migrations')
      },
    })
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    const result = await engine.apply({ ...ctx, runtimeDb } as any, {
      ...APPLY_INPUT,
      idempotencyKey: 'schema-add-linkedin',
    })

    expect(result).toMatchObject({
      checksum: APPLY_INPUT.checksum,
      status: 'applied',
      appliedOperations: APPLY_OPERATIONS,
      idempotencyKey: 'schema-add-linkedin',
    })
    expect(typeof result.migrationId).toBe('string')
    const stored = records.get(result.migrationId as string)
    expect(stored).toMatchObject({
      checksum: APPLY_INPUT.checksum,
      status: 'applied',
      forwardOperations: APPLY_OPERATIONS,
      reverseOperations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
      }],
      appliedBy: null,
    })
    expect(migrationLedger.updateStatus).toHaveBeenNthCalledWith(1, expect.objectContaining(ctx), result.migrationId, expect.objectContaining({
      status: 'running',
      startedAt: expect.any(Date),
    }))
    expect(migrationLedger.updateStatus).toHaveBeenNthCalledWith(2, expect.objectContaining(ctx), result.migrationId, expect.objectContaining({
      status: 'applied',
      appliedAt: expect.any(Date),
    }))
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationDb.execute).toHaveBeenCalledTimes(1)
    expect(runtimeDb.execute).not.toHaveBeenCalled()
    expect(runtimeDb.query).not.toHaveBeenCalled()

    await expect(engine.apply(ctx, {
      ...APPLY_INPUT,
      idempotencyKey: 'schema-add-linkedin',
    })).resolves.toMatchObject({
      migrationId: result.migrationId,
      checksum: APPLY_INPUT.checksum,
      status: 'applied',
      appliedOperations: APPLY_OPERATIONS,
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('retries failed idempotency-key migrations instead of treating them as completed', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockRejectedValueOnce(new Error('temporary DDL failure'))
      .mockResolvedValue(undefined)
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const records = new Map<string, SchemaMigrationRecord>()
    vi.mocked(migrationLedger.create).mockImplementation(async (_ctx, record) => {
      records.set(record.id, record)
      return record
    })
    vi.mocked(migrationLedger.list).mockImplementation(async () => ({
      data: [...records.values()],
      hasMore: false,
      nextCursor: null,
    }))
    vi.mocked(migrationLedger.updateStatus).mockImplementation(async (_ctx, id, patch) => {
      const record = records.get(id)
      if (!record) return null
      const next = { ...record, ...patch } as SchemaMigrationRecord
      records.set(id, next)
      return next
    })
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      ...APPLY_INPUT,
      idempotencyKey: 'retry-after-failure',
    })).rejects.toMatchObject({ code: 'MIGRATION_FAILED' })

    await expect(engine.apply(ctx, {
      ...APPLY_INPUT,
      idempotencyKey: 'retry-after-failure',
    })).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: APPLY_OPERATIONS,
      idempotencyKey: 'retry-after-failure',
    })

    expect(authority.run).toHaveBeenCalledTimes(2)
    expect([...records.values()].map((record) => record.status)).toEqual(['failed', 'applied'])
  })

  it('retries checksum-only migrations after a failed ledger row', async () => {
    const failed = migrationRecord({
      forwardOperations: APPLY_OPERATIONS,
      status: 'failed',
      description: 'failed first attempt',
    })
    const migrationLedger = trackingLedger([failed])
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, APPLY_INPUT)).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: APPLY_OPERATIONS,
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('rejects reused migration idempotency keys with different operations', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    const records: SchemaMigrationRecord[] = []
    vi.mocked(migrationLedger.create).mockImplementation(async (_ctx, record) => {
      records.push(record)
      return record
    })
    vi.mocked(migrationLedger.list).mockImplementation(async () => ({
      data: records,
      hasMore: false,
      nextCursor: null,
    }))
    vi.mocked(migrationLedger.updateStatus).mockImplementation(async (_ctx, id, patch) => {
      const index = records.findIndex((record) => record.id === id)
      if (index === -1) return null
      records[index] = { ...records[index]!, ...patch } as SchemaMigrationRecord
      return records[index]!
    })
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await engine.apply(ctx, {
      ...APPLY_INPUT,
      idempotencyKey: 'same-key',
    })

    const otherOperations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.add',
      entityType: 'contacts',
      fieldName: 'twitter_url',
      fieldType: 'url',
    }]
    await expect(engine.apply(ctx, {
      operations: otherOperations,
      checksum: checksumFor(otherOperations),
      idempotencyKey: 'same-key',
    })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    })
  })

  it('does not match idempotency keys by freeform description substring', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const otherOperations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.add',
      entityType: 'contacts',
      fieldName: 'twitter_url',
      fieldType: 'url',
    }]
    const migrationLedger = trackingLedger([
      migrationRecord({
        forwardOperations: APPLY_OPERATIONS,
        description: 'legacy note [idempotency:same-key] is not structured metadata',
      }),
    ])
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations: otherOperations,
      checksum: checksumFor(otherOperations),
      idempotencyKey: 'same-key',
    })).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: otherOperations,
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationDb.execute).toHaveBeenCalledTimes(1)
  })

  it('rejects new idempotency keys on checksum-only replays', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger([
      migrationRecord({
        forwardOperations: APPLY_OPERATIONS,
        description: 'Add linkedin_url custom field to contacts',
      }),
    ])
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      ...APPLY_INPUT,
      idempotencyKey: 'new-unbound-key',
    })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('applies confirmed custom field delete migrations as non-rollbackable data removal', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000030', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: operations,
      rollbackable: false,
      rollbackDecision: {
        decision: 'non_rollbackable',
      },
    })
    expect(migrationLedger.create).toHaveBeenCalledWith(expect.objectContaining(ctx), expect.objectContaining({
      forwardOperations: operations,
      reverseOperations: [],
    }))
    expect(migrationLedger.updateStatus).toHaveBeenCalledTimes(2)
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('rejects batched migrations until multi-target locking is implemented', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [
      APPLY_OPERATIONS[0]!,
      {
        type: 'custom_field.add',
        entityType: 'companies',
        fieldName: 'linkedin_url',
        fieldType: 'url',
      },
    ]
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum: checksumFor(operations),
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(migrationLedger.create).not.toHaveBeenCalled()
    expect(migrationLedger.withMigrationLock).not.toHaveBeenCalled()
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('does not create a pending ledger row when migration lock acquisition fails', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    vi.mocked(migrationLedger.withMigrationLock).mockRejectedValue(Object.assign(new Error('locked'), {
      code: 'MIGRATION_CONFLICT',
    }))
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, APPLY_INPUT)).rejects.toMatchObject({
      code: 'MIGRATION_CONFLICT',
    })
    expect(migrationLedger.create).not.toHaveBeenCalled()
    expect(migrationLedger.updateStatus).not.toHaveBeenCalled()
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('records sanitized apply failure details when semantic execution fails inside authority', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute).mockRejectedValue(new Error('raw sql ALTER TABLE contacts ADD COLUMN secret text leaked'))
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    let stored: SchemaMigrationRecord | null = null
    vi.mocked(migrationLedger.create).mockImplementation(async (_ctx, record) => {
      stored = record
      return record
    })
    vi.mocked(migrationLedger.updateStatus).mockImplementation(async (_ctx, _id, patch) => {
      stored = { ...stored!, ...patch } as SchemaMigrationRecord
      return stored
    })
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, APPLY_INPUT)).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'apply' },
    })
    expect(stored).toMatchObject({
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
      errorMessage: 'Schema migration failed (phase=apply; causeCode=INTERNAL_ERROR)',
      failedAt: expect.any(Date),
    })
  })

  it('rolls back an applied migration through authority and marks the ledger rolled back', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const migrationId = 'migration_01J00000000000000000000000'
    let record = {
      ...migrationRecord({
        id: migrationId,
        forwardOperations: APPLY_OPERATIONS,
      }),
      reverseOperations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
      }],
    } as SchemaMigrationRecord
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue(record)
    vi.mocked(migrationLedger.updateStatus).mockImplementation(async (_ctx, id, patch) => {
      expect(id).toBe(migrationId)
      record = { ...record, ...patch } as SchemaMigrationRecord
      return record
    })
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000020', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    const rollbackChecksum = computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: ctx.orgId,
      operations: record.reverseOperations,
    })
    await expect(engine.rollback(ctx, {
      migrationId,
      checksum: rollbackChecksum,
      confirmation: {
        destructive: true,
        checksum: rollbackChecksum,
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toMatchObject({
      migrationId,
      rolledBackMigrationId: migrationId,
      status: 'rolled_back',
      operations: record.reverseOperations,
    })

    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationDb.execute).toHaveBeenCalledTimes(2)
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'rolled_back',
      rolledBackAt: expect.any(Date),
    }))
  })

  it('records sanitized rollback failure details', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute).mockRejectedValue(new Error('DROP TABLE contacts leaked from provider'))
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const migrationId = 'migration_01J00000000000000000000000'
    const record = {
      ...migrationRecord({
        id: migrationId,
        forwardOperations: APPLY_OPERATIONS,
      }),
      reverseOperations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
      }],
    } as SchemaMigrationRecord
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue(record)
    vi.mocked(migrationLedger.updateStatus).mockResolvedValue(record)
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    const rollbackChecksum = computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: ctx.orgId,
      operations: record.reverseOperations,
    })
    await expect(engine.rollback(ctx, {
      migrationId,
      checksum: rollbackChecksum,
      confirmation: {
        destructive: true,
        checksum: rollbackChecksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'rollback' },
    })
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'applied',
      errorCode: 'MIGRATION_FAILED',
      errorMessage: 'Schema migration failed (phase=rollback; causeCode=INTERNAL_ERROR)',
      failedAt: expect.any(Date),
    }))
  })

  it('rejects rollback of non-reversible delete ledgers without marking rolled_back', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    const migrationId = 'migration_01J00000000000000000000050'
    const record = {
      ...migrationRecord({
        id: migrationId,
        forwardOperations: [{
          type: 'custom_field.delete',
          entityType: 'contacts',
          fieldName: 'linkedin_url',
        }],
      }),
      destructive: true,
      reverseOperations: [],
    } as SchemaMigrationRecord
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue(record)
    const engine = makeEngine(createInMemoryCustomFieldRepo(), authority, migrationLedger, undefined, 'development')

    await expect(engine.rollback(ctx, { migrationId })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).not.toHaveBeenCalled()
    expect(migrationLedger.updateStatus).not.toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'rolled_back',
    }))
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

  it('rejects rollback with missing migration authority after preconditions and confirmation pass', async () => {
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
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, undefined, migrationLedger)

    await expect(engine.rollback(ctx, {
      migrationId,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_AUTHORITY_UNAVAILABLE',
    })
  })

  it('fails closed for unsupported destructive rollback operations after confirmation', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
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
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.rollback(ctx, {
      migrationId,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'applied',
      errorCode: 'MIGRATION_OPERATION_UNSUPPORTED',
      errorMessage: expect.stringContaining('phase=rollback'),
    }))
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

  it('routes confirmed destructive field updates and deletes through authority', async () => {
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
    const engine = makeEngine(repo, authority, ledger(), undefined, 'development')

    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', {
      fieldType: 'number',
      confirmation: {
        destructive: true,
        checksum: checksumFor(updateOperations),
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url', {
      confirmation: {
        destructive: true,
        checksum: checksumFor(deleteOperations),
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toBeUndefined()
    expect(authority.run).toHaveBeenCalledTimes(2)
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
    const engine = makeEngine(repo, authority, ledger(), undefined, 'development')

    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url', {
      entityType: 'companies',
      fieldName: 'other_field',
      confirmation: {
        destructive: true,
        checksum: checksumFor(operations),
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toBeUndefined()
    expect(authority.run).toHaveBeenCalledTimes(1)
  })

  it('rejects custom field rename when the new name already exists on the same entity', async () => {
    const authority = makeAuthority()
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.rename',
      entityType: 'contacts',
      fieldName: 'linkedin',
      newFieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000044', 'linkedin'),
      field('field_01J00000000000000000000045', 'linkedin_url'),
      field('field_01J00000000000000000000046', 'linkedin_url', ctx.orgId, { entityType: 'companies' }),
      field('field_01J00000000000000000000047', 'linkedin_url', betaCtx.orgId),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'newFieldName',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('rejects custom_field.add for entities without custom field value storage', async () => {
    const customFields = createInMemoryCustomFieldRepo()
    const migrationLedger = trackingLedger()
    const migrationAuthority = makeAuthority()
    const engine = makeEngine(customFields, migrationAuthority, migrationLedger)
    const operation = {
      type: 'custom_field.add',
      entityType: 'pipelines',
      fieldName: 'bad_pipeline_field',
      fieldType: 'text',
      label: 'Bad pipeline field',
    } as const

    const preview = await engine.preview(ctx, { operations: [operation] })

    await expect(engine.apply(ctx, {
      operations: [operation],
      checksum: preview.checksum,
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })

    await expect(customFields.list(ctx, {
      filter: { entity_type: 'pipelines', field_name: 'bad_pipeline_field' },
    })).resolves.toMatchObject({ data: [] })
    expect(migrationAuthority.run).not.toHaveBeenCalled()
    expect(migrationLedger.create).not.toHaveBeenCalled()
  })

  it('rejects addField for entities without custom field value storage', async () => {
    const customFields = createInMemoryCustomFieldRepo()
    const migrationAuthority = makeAuthority()
    const engine = makeEngine(customFields, migrationAuthority)

    await expect(engine.addField(ctx, 'pipelines', {
      name: 'bad_pipeline_field',
      type: 'text',
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })

    await expect(customFields.list(ctx, {
      filter: { entity_type: 'pipelines', field_name: 'bad_pipeline_field' },
    })).resolves.toMatchObject({ data: [] })
    expect(migrationAuthority.run).not.toHaveBeenCalled()
  })

  it('rejects duplicate custom_field.add with CONFLICT before elevated execution', async () => {
    const customFields = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000048', 'linkedin_url'),
    ])
    const migrationLedger = trackingLedger()
    const migrationAuthority = makeAuthority()
    const engine = makeEngine(customFields, migrationAuthority, migrationLedger, undefined, 'development')

    const preview = await engine.preview(ctx, { operations: APPLY_OPERATIONS })

    // The duplicate makes preview classify this add as destructive; the
    // confirmation gets us past that gate to the precondition check.
    await expect(engine.apply(ctx, {
      operations: APPLY_OPERATIONS,
      checksum: preview.checksum,
      confirmation: {
        destructive: true,
        checksum: preview.checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'fieldName',
    })

    expect(migrationAuthority.run).not.toHaveBeenCalled()
    expect(migrationLedger.create).not.toHaveBeenCalled()
  })

  it('rechecks custom_field.add duplicate preconditions inside the migration lock', async () => {
    const duplicate = field('field_01J00000000000000000000049', 'linkedin_url')
    let filteredListCalls = 0
    const customFields = createInMemoryCustomFieldRepo({
      async list(_requestCtx, query) {
        if (query.filter?.field_name === 'linkedin_url') {
          filteredListCalls += 1
          // First filtered read is the pre-lock precondition check (no
          // duplicate yet); a concurrent migration then creates the field
          // before this request enters the migration lock.
          if (filteredListCalls === 1) {
            return { data: [], hasMore: false, nextCursor: null }
          }
          return { data: [duplicate], hasMore: false, nextCursor: null }
        }
        return { data: [], hasMore: false, nextCursor: null }
      },
    })
    const migrationLedger = trackingLedger()
    const migrationAuthority = makeAuthority()
    const engine = makeEngine(customFields, migrationAuthority, migrationLedger)

    await expect(engine.apply(ctx, APPLY_INPUT)).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'fieldName',
    })

    expect(filteredListCalls).toBe(2)
    expect(migrationAuthority.run).not.toHaveBeenCalled()
    expect(migrationLedger.create).not.toHaveBeenCalled()
  })

  it('updates safe custom field metadata without migration authority', async () => {
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000040', 'linkedin_url', ctx.orgId, {
        label: 'LinkedIn',
        description: 'Old description',
      }),
    ])
    const authority = makeAuthority()
    const engine = makeEngine(repo, authority)

    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', {
      label: 'LinkedIn URL',
      description: 'Profile URL',
    })).resolves.toMatchObject({
      id: 'field_01J00000000000000000000040',
      fieldName: 'linkedin_url',
      fieldType: 'text',
      label: 'LinkedIn URL',
      description: 'Profile URL',
    })
    await expect(repo.get(ctx, 'field_01J00000000000000000000040')).resolves.toMatchObject({
      fieldName: 'linkedin_url',
      label: 'LinkedIn URL',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('updates safe custom field metadata after migration-created fields without migration authority', async () => {
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000042', 'tier', ctx.orgId, {
        label: 'Tier',
        description: 'Old description',
      }),
    ])
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
    const authority = makeAuthority()
    const engine = makeEngine(repo, authority, migrationLedger)

    await expect(engine.updateField(ctx, 'contacts', 'tier', {
      label: 'Customer Tier',
      description: 'New description',
    })).resolves.toMatchObject({
      id: 'field_01J00000000000000000000042',
      fieldName: 'tier',
      label: 'Customer Tier',
      description: 'New description',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('rejects destructive custom field updates without confirmation before authority', async () => {
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000041', 'linkedin_url'),
    ])
    const authority = makeAuthority()
    const engine = makeEngine(repo, authority)

    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', {
      fieldType: 'number',
    })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('applies confirmed custom field rename through authority and migrates values', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const adapter = {
      name: 'postgres',
      dialect: 'postgres',
      supportsJsonbIndexes: true,
      async getSchemaSnapshot() {
        return {
          customFields: [],
          tables: ['contacts', 'custom_field_definitions', 'schema_migrations'],
        }
      },
    } satisfies SchemaEngineSchemaAdapter
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.rename',
      entityType: 'contacts',
      fieldName: 'linkedin',
      newFieldName: 'linkedin_url',
    }]
    const checksum = checksumForAdapter(operations, { name: adapter.name, dialect: adapter.dialect })
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000042', 'linkedin'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, adapter, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: operations,
      rollbackable: true,
      rollbackDecision: {
        decision: 'rollbackable',
      },
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationDb.execute).toHaveBeenCalledTimes(3)
    // The authority connection may be an RLS-enforced role with no tenant
    // context (CLI direct mode defaults migration db to the runtime db);
    // without set_config the org-scoped DML silently matches zero rows.
    const tenantContextSql = renderSql(vi.mocked(migrationDb.execute).mock.calls[0]![0])
    expect(tenantContextSql).toContain("set_config('app.current_org_id'")
    const valueRenameSql = renderSql(vi.mocked(migrationDb.execute).mock.calls[2]![0])
    expect(valueRenameSql).toContain('jsonb_build_object($2::text, custom_fields -> $3::text)')
    expect(valueRenameSql).toContain('custom_fields ? $5::text')
  })

  it('applies confirmed custom field delete through authority after metadata preconditions pass', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000043', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: operations,
      rollbackable: false,
      rollbackDecision: {
        decision: 'non_rollbackable',
      },
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationDb.execute).toHaveBeenCalledTimes(2)
  })

  it('applies direct delete for every custom_fields table and rejects unsupported entity types before authority', async () => {
    const extensibleEntityTypes = [
      'companies',
      'contacts',
      'deals',
      'activities',
      'tasks',
      'notes',
      'products',
      'payments',
      'contracts',
      'sequences',
    ]

    for (const entityType of extensibleEntityTypes) {
      const migrationDb = makeMigrationDb()
      const authority = makeAuthority(migrationDb)
      const operations: SchemaMigrationPublicForwardOperation[] = [{
        type: 'custom_field.delete',
        entityType,
        fieldName: 'priority',
      }]
      const checksum = checksumFor(operations)
      const repo = createInMemoryCustomFieldRepo([
        field(`field_01J00000000000000000${entityType.padEnd(8, '0').slice(0, 8)}`, 'priority', ctx.orgId, {
          entityType,
        }),
      ])
      const engine = makeEngine(repo, authority, trackingLedger(), undefined, 'development')

      await expect(engine.apply(ctx, {
        operations,
        checksum,
        confirmation: {
          destructive: true,
          checksum,
          confirmedAt: new Date().toISOString(),
        },
      })).resolves.toMatchObject({
        status: 'applied',
        appliedOperations: operations,
        rollbackable: false,
        rollbackDecision: {
          decision: 'non_rollbackable',
        },
      })
      expect(authority.run).toHaveBeenCalledTimes(1)
      expect(migrationDb.execute).toHaveBeenCalledTimes(2)
    }

    const authority = makeAuthority()
    const unsupportedOperations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'pipelines',
      fieldName: 'priority',
    }]
    const checksum = checksumFor(unsupportedOperations)
    const engine = makeEngine(createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000048', 'priority', ctx.orgId, { entityType: 'pipelines' }),
    ]), authority, trackingLedger(), undefined, 'development')

    await expect(engine.apply(ctx, {
      operations: unsupportedOperations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'entityType',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('renames only the targeted entity type when another entity has the same custom field key', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.rename',
      entityType: 'contacts',
      fieldName: 'linkedin',
      newFieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000049', 'linkedin'),
      field('field_01J00000000000000000000050', 'linkedin_url', ctx.orgId, { entityType: 'companies' }),
    ])
    const engine = makeEngine(repo, authority, trackingLedger(), undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).resolves.toMatchObject({
      status: 'applied',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(migrationDb.execute).toHaveBeenCalledTimes(2)
  })

  it('fails apply when a SQLite-shaped metadata delete affects no rows', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockResolvedValueOnce({ changes: 1 }) // value cleanup (zero or more rows is fine)
      .mockResolvedValueOnce({ changes: 0 }) // metadata delete silently matched nothing
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000051', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'apply', causeCode: 'VALIDATION_FAILED' },
    })
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
      errorMessage: 'Schema migration failed (phase=apply; causeCode=VALIDATION_FAILED)',
      failedAt: expect.any(Date),
    }))
    expect(migrationLedger.updateStatus).not.toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'applied',
    }))
  })

  it('fails apply when a Postgres-shaped metadata delete affects no rows', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockResolvedValueOnce({ rowCount: 1 }) // set_config tenant context
      .mockResolvedValueOnce({ rowCount: 7 }) // value cleanup (any count is fine)
      .mockResolvedValueOnce({ rowCount: 0 }) // metadata delete silently matched nothing
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const adapter = {
      name: 'postgres',
      dialect: 'postgres',
      supportsJsonbIndexes: true,
      async getSchemaSnapshot() {
        return {
          customFields: [],
          tables: ['contacts', 'custom_field_definitions', 'schema_migrations'],
        }
      },
    } satisfies SchemaEngineSchemaAdapter
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const checksum = checksumForAdapter(operations, { name: adapter.name, dialect: adapter.dialect })
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000052', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, adapter, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'apply', causeCode: 'VALIDATION_FAILED' },
    })
    expect(migrationDb.execute).toHaveBeenCalledTimes(3)
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
    }))
    expect(migrationLedger.updateStatus).not.toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'applied',
    }))
  })

  it('fails apply before value rename when a SQLite-shaped metadata rename affects no rows', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockResolvedValueOnce({ changes: 0 }) // metadata update silently matched nothing
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.rename',
      entityType: 'contacts',
      fieldName: 'linkedin',
      newFieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000053', 'linkedin'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'apply', causeCode: 'VALIDATION_FAILED' },
    })
    // Metadata update is the first and only execute: the value JSON rename
    // must not run after a zero-row metadata update.
    expect(migrationDb.execute).toHaveBeenCalledTimes(1)
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
      errorMessage: 'Schema migration failed (phase=apply; causeCode=VALIDATION_FAILED)',
    }))
    expect(migrationLedger.updateStatus).not.toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'applied',
    }))
  })

  it('fails apply when a Postgres-shaped metadata rename affects no rows', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockResolvedValueOnce({ rowCount: 1 }) // set_config tenant context
      .mockResolvedValueOnce({ rowCount: 0 }) // metadata update silently matched nothing
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const adapter = {
      name: 'postgres',
      dialect: 'postgres',
      supportsJsonbIndexes: true,
      async getSchemaSnapshot() {
        return {
          customFields: [],
          tables: ['contacts', 'custom_field_definitions', 'schema_migrations'],
        }
      },
    } satisfies SchemaEngineSchemaAdapter
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.rename',
      entityType: 'contacts',
      fieldName: 'linkedin',
      newFieldName: 'linkedin_url',
    }]
    const checksum = checksumForAdapter(operations, { name: adapter.name, dialect: adapter.dialect })
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000054', 'linkedin'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, adapter, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'apply', causeCode: 'VALIDATION_FAILED' },
    })
    // set_config + metadata update only — value rename must not run.
    expect(migrationDb.execute).toHaveBeenCalledTimes(2)
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
    }))
  })

  it('fails apply closed when metadata DML returns no row-count shape at all', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockResolvedValueOnce({ changes: 1 }) // value cleanup
      .mockResolvedValueOnce(undefined) // metadata delete result without a row count
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const operations: SchemaMigrationPublicForwardOperation[] = [{
      type: 'custom_field.delete',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    }]
    const checksum = checksumFor(operations)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000055', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    await expect(engine.apply(ctx, {
      operations,
      checksum,
      confirmation: {
        destructive: true,
        checksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'apply', causeCode: 'INTERNAL_ERROR' },
    })
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, expect.any(String), expect.objectContaining({
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
    }))
  })

  it('keeps the migration applied when a rollback metadata rename affects no rows', async () => {
    const migrationDb = makeMigrationDb()
    vi.mocked(migrationDb.execute)
      .mockResolvedValueOnce({ rowCount: 0 }) // reverse metadata update silently matched nothing
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const migrationId = 'migration_01J00000000000000000000060'
    const record = {
      ...migrationRecord({
        id: migrationId,
        forwardOperations: [{
          type: 'custom_field.rename',
          entityType: 'contacts',
          fieldName: 'linkedin',
          newFieldName: 'linkedin_url',
        }],
      }),
      reverseOperations: [{
        type: 'custom_field.rename',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
        newFieldName: 'linkedin',
      }],
    } as SchemaMigrationRecord
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue(record)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000056', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    const rollbackChecksum = computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: ctx.orgId,
      operations: record.reverseOperations,
    })
    await expect(engine.rollback(ctx, {
      migrationId,
      checksum: rollbackChecksum,
      confirmation: {
        destructive: true,
        checksum: rollbackChecksum,
        confirmedAt: new Date().toISOString(),
      },
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
      details: { phase: 'rollback', causeCode: 'VALIDATION_FAILED' },
    })
    // Reverse metadata update is the first and only execute: value JSON
    // rename must not run after a zero-row metadata update.
    expect(migrationDb.execute).toHaveBeenCalledTimes(1)
    // The rollback failure path keeps the migration applied — never failed
    // or rolled_back — so it stays eligible for a later rollback attempt.
    expect(migrationLedger.updateStatus).toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'applied',
      errorCode: 'MIGRATION_FAILED',
      errorMessage: 'Schema migration failed (phase=rollback; causeCode=VALIDATION_FAILED)',
      failedAt: expect.any(Date),
    }))
    expect(migrationLedger.updateStatus).not.toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'rolled_back',
    }))
    expect(migrationLedger.updateStatus).not.toHaveBeenCalledWith(ctx, migrationId, expect.objectContaining({
      status: 'failed',
    }))
  })
})

describe('strict apply/rollback output parsing (SQL leakage guard)', () => {
  const APPLY_OUTPUT_KEYS = [
    'appliedOperations',
    'checksum',
    'migrationId',
    'rollbackDecision',
    'rollbackable',
    'status',
  ]
  const ROLLBACK_OUTPUT_KEYS = [
    'checksum',
    'migrationId',
    'operations',
    'rolledBackMigrationId',
    'status',
  ]

  it('fresh apply returns only strict apply output keys (no SQL statement fields)', async () => {
    const authority = makeAuthority()
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority)

    const result = await engine.apply(ctx, APPLY_INPUT)

    expect(Object.keys(result).sort()).toEqual(APPLY_OUTPUT_KEYS)
    expect(result).not.toHaveProperty('sqlStatements')
    expect(result).not.toHaveProperty('rollbackStatements')
  })

  it('idempotent existing-record apply returns only strict apply output keys', async () => {
    const authority = makeAuthority()
    const existing = {
      ...migrationRecord({ forwardOperations: APPLY_OPERATIONS }),
      sqlStatements: ['alter table contacts add column secret text'],
      rollbackStatements: ['alter table contacts drop column secret'],
    } as SchemaMigrationRecord
    const migrationLedger = trackingLedger([existing])
    const repo = createInMemoryCustomFieldRepo()
    const engine = makeEngine(repo, authority, migrationLedger)

    const result = await engine.apply(ctx, APPLY_INPUT)

    expect(result.migrationId).toBe(existing.id)
    expect(Object.keys(result).sort()).toEqual(APPLY_OUTPUT_KEYS)
    expect(result).not.toHaveProperty('sqlStatements')
    expect(result).not.toHaveProperty('rollbackStatements')
    expect(authority.run).not.toHaveBeenCalled()
  })

  it('rollback returns only strict rollback output keys (no SQL statement fields)', async () => {
    const migrationDb = makeMigrationDb()
    const authority = makeAuthority(migrationDb)
    const migrationLedger = trackingLedger()
    const migrationId = 'migration_01J00000000000000000000000'
    const record = {
      ...migrationRecord({
        id: migrationId,
        forwardOperations: APPLY_OPERATIONS,
      }),
      reverseOperations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'linkedin_url',
      }],
      sqlStatements: ['alter table contacts add column secret text'],
      rollbackStatements: ['alter table contacts drop column secret'],
    } as SchemaMigrationRecord
    vi.mocked(migrationLedger.assertRollbackPreconditions).mockResolvedValue(record)
    vi.mocked(migrationLedger.updateStatus).mockResolvedValue(record)
    const repo = createInMemoryCustomFieldRepo([
      field('field_01J00000000000000000000020', 'linkedin_url'),
    ])
    const engine = makeEngine(repo, authority, migrationLedger, undefined, 'development')

    const rollbackChecksum = computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: ctx.orgId,
      operations: record.reverseOperations,
    })
    const result = await engine.rollback(ctx, {
      migrationId,
      checksum: rollbackChecksum,
      confirmation: {
        destructive: true,
        checksum: rollbackChecksum,
        confirmedAt: new Date().toISOString(),
      },
    })

    expect(Object.keys(result).sort()).toEqual(ROLLBACK_OUTPUT_KEYS)
    expect(result).not.toHaveProperty('sqlStatements')
    expect(result).not.toHaveProperty('rollbackStatements')
  })

  it('strict apply output schema rejects outputs carrying SQL statement fields', () => {
    const validApplyOutput = {
      migrationId: 'migration_01J00000000000000000000000',
      checksum: checksumFor(APPLY_OPERATIONS),
      status: 'applied',
      appliedOperations: APPLY_OPERATIONS,
      rollbackable: true,
      rollbackDecision: { decision: 'rollbackable' },
    }
    expect(() => schemaMigrationApplyOutputSchema.parse(validApplyOutput)).not.toThrow()
    expect(() => schemaMigrationApplyOutputSchema.parse({
      ...validApplyOutput,
      sqlStatements: ['alter table contacts add column secret text'],
    })).toThrow()
    expect(() => schemaMigrationApplyOutputSchema.parse({
      ...validApplyOutput,
      rollback_statements: ['legacy snake case rollback'],
    })).toThrow()
  })

  it('strict rollback output schema rejects outputs carrying SQL statement fields', () => {
    const validRollbackOutput = {
      migrationId: 'migration_01J00000000000000000000000',
      rolledBackMigrationId: 'migration_01J00000000000000000000000',
      checksum: checksumFor(APPLY_OPERATIONS),
      status: 'rolled_back',
      operations: APPLY_OPERATIONS,
    }
    expect(() => schemaMigrationRollbackOutputSchema.parse(validRollbackOutput)).not.toThrow()
    expect(() => schemaMigrationRollbackOutputSchema.parse({
      ...validRollbackOutput,
      rollbackStatements: ['alter table contacts drop column secret'],
    })).toThrow()
    expect(() => schemaMigrationRollbackOutputSchema.parse({
      ...validRollbackOutput,
      sql_statements: ['legacy snake case'],
    })).toThrow()
  })
})
