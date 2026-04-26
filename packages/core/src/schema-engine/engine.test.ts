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

function makeEngine(
  customFields: CustomFieldDefinitionRepository,
  migrationAuthority?: SchemaMigrationAuthority,
): OrbitSchemaEngine {
  return new OrbitSchemaEngine({
    customFields: () => customFields,
    ledger: () => ledger(),
    ...(migrationAuthority ? { migrationAuthority } : {}),
  })
}

function makeAuthority() {
  const run = vi.fn(async <T>(fn: Parameters<SchemaMigrationAuthority['run']>[0]): Promise<T> => {
    return fn({} as Parameters<Parameters<SchemaMigrationAuthority['run']>[0]>[0])
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

  it('calls migration authority visibly for apply and rollback placeholders', async () => {
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
    await expect(engine.rollback(ctx, 'migration_01J00000000000000000000000')).resolves.toMatchObject({
      rolledBackMigrationId: 'migration_01J00000000000000000000000',
      status: 'rolled_back',
      operations: [],
    })

    expect(authority.run).toHaveBeenCalledTimes(2)
  })

  it('calls migration authority before rejecting destructive field placeholders as unsupported', async () => {
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
    expect(authority.run).toHaveBeenCalledTimes(2)
  })
})
