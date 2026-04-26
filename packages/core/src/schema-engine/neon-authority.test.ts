import { describe, expect, it, vi } from 'vitest'

import type { MigrationDatabase, OrbitAuthContext } from '../adapters/interface.js'
import { createInMemoryCustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import { createInMemorySchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import { OrbitSchemaEngine, type SchemaEngineSchemaAdapter, type SchemaMigrationAuthority } from './engine.js'
import {
  computeSchemaMigrationChecksum,
  type SchemaMigrationPublicForwardOperation,
} from './migrations.js'

const ctx: OrbitAuthContext = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
  scopes: ['*'],
}

const neonAdapter: SchemaEngineSchemaAdapter = {
  name: 'neon',
  dialect: 'postgres',
  supportsJsonbIndexes: true,
  async getSchemaSnapshot() {
    return {
      customFields: [],
      tables: ['contacts', 'custom_field_definitions', 'schema_migrations'],
    }
  },
}

const addLinkedInField: SchemaMigrationPublicForwardOperation = {
  type: 'custom_field.add',
  entityType: 'contacts',
  fieldName: 'linkedin_url',
  fieldType: 'url',
}

function checksumFor(operations: SchemaMigrationPublicForwardOperation[]) {
  return computeSchemaMigrationChecksum({
    adapter: { name: neonAdapter.name, dialect: neonAdapter.dialect },
    orgId: ctx.orgId,
    operations,
  })
}

function makeMigrationDb(events: string[], execute = vi.fn(async () => undefined)): MigrationDatabase {
  return {
    async transaction<T>(fn: (tx: MigrationDatabase) => Promise<T>) {
      return fn(this)
    },
    async execute(statement) {
      events.push('migration:execute')
      return execute(statement)
    },
    async query() {
      return []
    },
  } satisfies MigrationDatabase
}

describe('Neon migration authority boundary', () => {
  it('runs fake branch-before-migrate before privileged migration execution', async () => {
    const events: string[] = []
    const ledger = createInMemorySchemaMigrationRepository()
    const migrationDb = makeMigrationDb(events)
    const authority: SchemaMigrationAuthority = {
      run: vi.fn(async (_context, fn) => {
        events.push('neon:create-branch')
        const result = await fn(migrationDb)
        events.push('neon:promote-branch')
        return result
      }),
    }
    const engine = new OrbitSchemaEngine({
      customFields: () => createInMemoryCustomFieldDefinitionRepository(),
      ledger: () => ledger,
      adapter: () => neonAdapter,
      migrationAuthority: authority,
      destructiveMigrationEnvironment: 'development',
    })

    await expect(engine.apply(ctx, {
      operations: [addLinkedInField],
      checksum: checksumFor([addLinkedInField]),
    })).resolves.toMatchObject({
      status: 'applied',
      appliedOperations: [addLinkedInField],
    })

    expect(events).toEqual(['neon:create-branch', 'migration:execute', 'neon:promote-branch'])
    expect(authority.run).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        operation: 'apply',
      }),
      expect.any(Function),
    )

    const migrations = await ledger.list(ctx, { limit: 10 })
    expect(migrations.data[0]?.adapter).toEqual({ name: 'neon', dialect: 'postgres' })
  })

  it('does not promote the fake branch when privileged migration execution fails', async () => {
    const events: string[] = []
    const ledger = createInMemorySchemaMigrationRepository()
    const migrationDb = makeMigrationDb(events, vi.fn(async () => {
      throw new Error('simulated Neon branch migration failure')
    }))
    const authority: SchemaMigrationAuthority = {
      run: vi.fn(async (_context, fn) => {
        events.push('neon:create-branch')
        try {
          const result = await fn(migrationDb)
          events.push('neon:promote-branch')
          return result
        } catch (error) {
          events.push('neon:discard-branch')
          throw error
        }
      }),
    }
    const engine = new OrbitSchemaEngine({
      customFields: () => createInMemoryCustomFieldDefinitionRepository(),
      ledger: () => ledger,
      adapter: () => neonAdapter,
      migrationAuthority: authority,
      destructiveMigrationEnvironment: 'development',
    })

    await expect(engine.apply(ctx, {
      operations: [addLinkedInField],
      checksum: checksumFor([addLinkedInField]),
    })).rejects.toMatchObject({
      code: 'MIGRATION_FAILED',
    })

    expect(events).toEqual(['neon:create-branch', 'migration:execute', 'neon:discard-branch'])
    expect(events).not.toContain('neon:promote-branch')

    const migrations = await ledger.list(ctx, { limit: 10 })
    expect(migrations.data[0]).toMatchObject({
      adapter: { name: 'neon', dialect: 'postgres' },
      status: 'failed',
      errorCode: 'MIGRATION_FAILED',
    })
  })
})
