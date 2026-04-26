import type { SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { asMigrationDatabase, type OrbitDatabase, type StorageAdapter } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import {
  computeSchemaMigrationChecksum,
  type SchemaMigrationAdapterScope,
  type SchemaMigrationForwardOperation,
} from '../../schema-engine/migrations.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemorySchemaMigrationRepository, createPostgresSchemaMigrationRepository } from './repository.js'
import { createSchemaMigrationAdminService } from './service.js'
import type { SchemaMigrationRecord } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const
const ctxB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' } as const
const userId = 'user_01ARYZ6S41YYYYYYYYYYYYYYYY'
const adapter = { name: 'sqlite', dialect: 'sqlite' } satisfies SchemaMigrationAdapterScope
const postgresAdapter = { name: 'postgres', dialect: 'postgres' } satisfies SchemaMigrationAdapterScope
const forwardOperations = [{
  type: 'custom_field.add',
  entityType: 'contacts',
  fieldName: 'priority',
  fieldType: 'text',
}] satisfies SchemaMigrationForwardOperation[]
const reverseOperations = [{
  type: 'custom_field.delete',
  entityType: 'contacts',
  fieldName: 'priority',
}] satisfies SchemaMigrationForwardOperation[]

function createUsersForOrg() {
  return createInMemoryUserRepository([{
    id: userId, organizationId: ctx.orgId, email: 'admin@example.com', name: 'Admin',
    role: 'admin', avatarUrl: null, externalAuthId: null, isActive: true, metadata: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'), updatedAt: new Date('2026-04-02T12:00:00.000Z'),
  }])
}

function renderSql(statement: SQL): string {
  return statement.toQuery({
    escapeName: (value) => value,
    escapeParam: () => '?',
    escapeString: (value) => JSON.stringify(value),
    casing: { getColumnCasing: (column) => column },
    inlineParams: false,
    paramStartIndex: { value: 0 },
  }).sql
}

function createFakePostgresAdapterForLocks() {
  const statements: string[] = []
  const tx = {
    transaction: async <T>(fn: (txDb: OrbitDatabase) => Promise<T>) => fn(tx as OrbitDatabase),
    execute: async () => undefined,
    query: vi.fn(async (statement: SQL) => {
      statements.push(renderSql(statement))
      return [{ acquired: true }]
    }),
  } satisfies OrbitDatabase
  const runWithMigrationAuthority = vi.fn(async <T>(fn: (db: ReturnType<typeof asMigrationDatabase>) => Promise<T>) =>
    fn(asMigrationDatabase(tx)),
  )

  return {
    statements,
    runWithMigrationAuthority,
    adapter: {
      name: 'postgres',
      dialect: 'postgres',
      supportsRls: true,
      supportsBranching: false,
      supportsJsonbIndexes: true,
      authorityModel: {
        runtimeAuthority: 'request-scoped',
        migrationAuthority: 'elevated',
        requestPathMayUseElevatedCredentials: false,
        notes: [],
      },
      unsafeRawDatabase: tx,
      users: {
        resolveByExternalAuthId: async () => null,
        upsertFromAuth: async () => 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      },
      connect: async () => undefined,
      disconnect: async () => undefined,
      migrate: async () => undefined,
      runWithMigrationAuthority,
      lookupApiKeyForAuth: async () => null,
      transaction: tx.transaction,
      beginTransaction: () => ({
        run: async (_ctx, fn) => fn(tx),
      }),
      execute: tx.execute,
      query: tx.query,
      withTenantContext: async (_ctx, fn) => fn(tx),
      getSchemaSnapshot: async () => ({ customFields: [], tables: [] }),
    } satisfies StorageAdapter,
  }
}

function makeRecord(overrides: Partial<SchemaMigrationRecord> = {}): SchemaMigrationRecord {
  const baseForwardOperations = overrides.forwardOperations ?? forwardOperations
  const baseAdapter = overrides.adapter ?? adapter

  return {
    id: generateId('migration'),
    organizationId: ctx.orgId,
    checksum: computeSchemaMigrationChecksum({
      adapter: baseAdapter,
      orgId: overrides.organizationId ?? ctx.orgId,
      operations: baseForwardOperations,
    }),
    adapter: baseAdapter,
    description: 'Add priority column to contacts',
    entityType: 'contacts',
    operationType: 'add_column',
    forwardOperations: baseForwardOperations,
    reverseOperations,
    destructive: false,
    status: 'applied',
    sqlStatements: ['ALTER TABLE contacts ADD COLUMN priority TEXT'],
    rollbackStatements: ['ALTER TABLE contacts DROP COLUMN priority'],
    appliedByUserId: userId,
    appliedBy: userId,
    approvedByUserId: null,
    startedAt: new Date('2026-04-02T11:59:00.000Z'),
    appliedAt: new Date('2026-04-02T12:00:00.000Z'),
    rolledBackAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('schemaMigration admin service', () => {
  it('lists schema migrations within org scope', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    const service = createSchemaMigrationAdminService(repository)

    const record = makeRecord()
    await repository.create(ctx, record)

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.id).toBe(record.id)
    expect('sqlStatements' in result.data[0]!).toBe(false)
    expect('rollbackStatements' in result.data[0]!).toBe(false)
  })

  it('gets a single schema migration by id', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    const service = createSchemaMigrationAdminService(repository)

    const record = makeRecord()
    await repository.create(ctx, record)

    const found = await service.get(ctx, record.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(record.id)
    expect(found!.description).toBe(record.description)
    expect('sqlStatements' in found!).toBe(false)
    expect('rollbackStatements' in found!).toBe(false)
  })

  it('tenant isolation: org B cannot see org A schema migrations', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    const service = createSchemaMigrationAdminService(repository)

    const record = makeRecord()
    await repository.create(ctx, record)

    expect(await service.get(ctxB, record.id)).toBeNull()

    const resultB = await service.list(ctxB, { limit: 10 })
    expect(resultB.data).toHaveLength(0)
  })

  it('stores semantic migration operations while sanitizing raw execution details from admin reads', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    const service = createSchemaMigrationAdminService(repository)

    const sqlStatements = [
      'ALTER TABLE contacts ADD COLUMN priority TEXT',
      'CREATE INDEX contacts_priority_idx ON contacts (priority)',
    ]
    const rollbackStatements = [
      'DROP INDEX contacts_priority_idx',
      'ALTER TABLE contacts DROP COLUMN priority',
    ]

    const record = makeRecord({ sqlStatements, rollbackStatements })
    await repository.create(ctx, record)

    const stored = await repository.get(ctx, record.id)
    expect(stored).not.toBeNull()
    expect(stored!.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(stored!.adapter).toEqual(adapter)
    expect(stored!.forwardOperations).toEqual(forwardOperations)
    expect(stored!.reverseOperations).toEqual(reverseOperations)
    expect(stored!.status).toBe('applied')
    expect(stored!.sqlStatements).toEqual(sqlStatements)
    expect(stored!.rollbackStatements).toEqual(rollbackStatements)

    const found = await service.get(ctx, record.id)
    expect(found).not.toBeNull()
    expect(found!.checksum).toBe(stored!.checksum)
    expect(found!.adapter).toEqual(adapter)
    expect(found!.status).toBe('applied')
    expect('sqlStatements' in found!).toBe(false)
    expect('rollbackStatements' in found!).toBe(false)
    expect('forwardOperations' in found!).toBe(false)
    expect('reverseOperations' in found!).toBe(false)
    expect('errorMessage' in found!).toBe(false)
  })

  it('validates same-tenant appliedByUserId reference (cross-tenant → RELATION_NOT_FOUND)', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const crossTenantUserId = 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ'
    const record = makeRecord({ appliedByUserId: crossTenantUserId })

    await expect(repository.create(ctx, record)).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('validates same-tenant approvedByUserId reference (cross-tenant → RELATION_NOT_FOUND)', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const crossTenantUserId = 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ'
    const record = makeRecord({ appliedByUserId: null, approvedByUserId: crossTenantUserId })

    await expect(repository.create(ctx, record)).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('preserves nullable entityType field', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    const service = createSchemaMigrationAdminService(repository)

    const record = makeRecord({ entityType: null })
    await repository.create(ctx, record)

    const found = await service.get(ctx, record.id)
    expect(found).not.toBeNull()
    expect(found!.entityType).toBeNull()
  })

  it('checks rollback preconditions within trusted org scope', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const record = makeRecord()
    await repository.create(ctx, record)

    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: record.id,
      adapter,
    })).resolves.toMatchObject({ id: record.id })

    await expect(repository.assertRollbackPreconditions(ctxB, {
      migrationId: record.id,
      adapter,
    })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })

  it('rejects rollback preconditions for wrong adapter, missing reverse operations, and failed status', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const record = makeRecord()
    const missingReverse = makeRecord({ id: generateId('migration'), reverseOperations: [] })
    const failed = makeRecord({
      id: generateId('migration'),
      status: 'failed',
      failedAt: new Date('2026-04-02T12:05:00.000Z'),
      errorCode: 'MIGRATION_FAILED',
      errorMessage: 'provider token secret leaked in stack trace',
    })
    await repository.create(ctx, record)
    await repository.create(ctx, missingReverse)
    await repository.create(ctx, failed)

    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: record.id,
      adapter: postgresAdapter,
    })).rejects.toMatchObject({ code: 'ROLLBACK_PRECONDITION_FAILED' })
    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: missingReverse.id,
      adapter,
    })).rejects.toMatchObject({ code: 'ROLLBACK_PRECONDITION_FAILED' })
    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: failed.id,
      adapter,
    })).rejects.toMatchObject({ code: 'ROLLBACK_PRECONDITION_FAILED' })
  })

  it('rejects rollback when a newer applied migration depends on the same target', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const first = makeRecord({ appliedAt: new Date('2026-04-02T12:00:00.000Z') })
    const newer = makeRecord({
      id: generateId('migration'),
      appliedAt: new Date('2026-04-02T12:05:00.000Z'),
      forwardOperations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'priority',
        patch: { label: 'Priority' },
      }],
      reverseOperations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'priority',
        patch: { label: 'Old Priority' },
      }],
    })
    await repository.create(ctx, first)
    await repository.create(ctx, newer)

    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: first.id,
      adapter,
    })).rejects.toMatchObject({
      code: 'ROLLBACK_PRECONDITION_FAILED',
      details: expect.objectContaining({
        blockingMigrationId: newer.id,
      }),
    })
  })

  it('serializes concurrent migrations for the same org, adapter, and target', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    let release!: () => void
    const hold = new Promise<void>((resolve) => { release = resolve })

    const winner = repository.withMigrationLock(ctx, {
      adapter,
      target: 'entity:contacts',
    }, async () => {
      await hold
      return 'winner'
    })

    await expect(repository.withMigrationLock(ctx, {
      adapter,
      target: 'entity:contacts',
    }, async () => 'loser')).rejects.toMatchObject({
      code: 'MIGRATION_CONFLICT',
      details: expect.objectContaining({
        acquired: false,
        contended: true,
        released: false,
      }),
    })

    release()
    await expect(winner).resolves.toMatchObject({
      result: 'winner',
      lock: expect.objectContaining({
        acquired: true,
        contended: false,
        released: true,
      }),
    })
  })

  it('does not block concurrent migrations for different orgs or unrelated targets', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })
    let release!: () => void
    const hold = new Promise<void>((resolve) => { release = resolve })

    const first = repository.withMigrationLock(ctx, {
      adapter,
      target: 'entity:contacts',
    }, async () => {
      await hold
      return 'first'
    })

    const differentOrg = await repository.withMigrationLock(ctxB, {
      adapter,
      target: 'entity:contacts',
    }, async () => 'different-org')
    const differentTarget = await repository.withMigrationLock(ctx, {
      adapter,
      target: 'entity:companies',
    }, async () => 'different-target')

    release()
    await expect(first).resolves.toMatchObject({ result: 'first' })
    expect(differentOrg.result).toBe('different-org')
    expect(differentTarget.result).toBe('different-target')
  })

  it('uses Postgres migration authority and advisory transaction locks for Postgres locks', async () => {
    const { adapter: fakeAdapter, runWithMigrationAuthority, statements } = createFakePostgresAdapterForLocks()
    const repository = createPostgresSchemaMigrationRepository(fakeAdapter)

    await expect(repository.withMigrationLock(ctx, {
      adapter: postgresAdapter,
      target: 'entity:contacts',
    }, async () => 'locked')).resolves.toMatchObject({
      result: 'locked',
      lock: expect.objectContaining({
        acquired: true,
        released: true,
      }),
    })

    expect(runWithMigrationAuthority).toHaveBeenCalledTimes(1)
    expect(statements.some((statement) => statement.includes('pg_try_advisory_xact_lock'))).toBe(true)
  })
})
