import { describe, expect, it, vi } from 'vitest'
import { OrbitSchemaEngine, type SchemaMigrationAuthority } from './engine.js'
import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'
import type { SchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import { OrbitError } from '../types/errors.js'

const ctx: OrbitAuthContext = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY', scopes: ['*'] }
const betaCtx: OrbitAuthContext = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ', scopes: ['*'] }

function field(id: string, fieldName: string, organizationId = ctx.orgId): CustomFieldDefinitionRecord {
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

function trackingLedger() {
  const repository: SchemaMigrationRepository = {
    create: vi.fn(async (_ctx, record) => record),
    get: vi.fn(async () => null),
    list: vi.fn(async () => ({ data: [], hasMore: false, nextCursor: null })),
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

function makeEngine(
  customFields: CustomFieldDefinitionRepository,
  migrationAuthority?: SchemaMigrationAuthority,
  migrationLedger: SchemaMigrationRepository = ledger(),
): OrbitSchemaEngine {
  return new OrbitSchemaEngine({
    customFields: () => customFields,
    ledger: () => migrationLedger,
    ...(migrationAuthority ? { migrationAuthority } : {}),
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

const APPLY_INPUT = {
  operations: [
    {
      type: 'custom_field.promote',
      entityType: 'contacts',
      fieldName: 'linkedin_url',
    },
  ],
  checksum: 'a'.repeat(64),
}
const DESTRUCTIVE_APPLY_INPUT = {
  operations: [
    {
      type: 'column.drop',
      tableName: 'contacts',
      columnName: 'legacy_score',
    },
  ],
  checksum: 'b'.repeat(64),
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

  it('previews deleting an existing custom field as destructive', async () => {
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

  it('throws structured unavailable errors when migration authority is missing', async () => {
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
    await expect(engine.rollback(ctx, 'migration_01J00000000000000000000000')).rejects.toMatchObject({
      code: 'MIGRATION_AUTHORITY_UNAVAILABLE',
    })
    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', { label: 'LinkedIn' })).rejects.toMatchObject({
      code: 'MIGRATION_AUTHORITY_UNAVAILABLE',
    })
    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url')).rejects.toMatchObject({
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

  it('calls migration authority with context for rollback placeholders before rejecting unsupported', async () => {
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
    const migrationId = 'migration_01J00000000000000000000000'

    await expect(engine.rollback(ctx, migrationId)).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).toHaveBeenCalledTimes(1)
    expect(authority.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        operation: 'rollback',
        migrationId,
      }),
      expect.any(Function),
    )
  })

  it('rejects unsupported destructive field placeholders before entering migration authority', async () => {
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

    await expect(engine.updateField(ctx, 'contacts', 'linkedin_url', { label: 'LinkedIn' })).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    await expect(engine.deleteField(ctx, 'contacts', 'linkedin_url')).rejects.toMatchObject({
      code: 'MIGRATION_OPERATION_UNSUPPORTED',
    })
    expect(authority.run).not.toHaveBeenCalled()
  })
})
