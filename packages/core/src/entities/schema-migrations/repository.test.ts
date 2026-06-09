import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import {
  computeSchemaMigrationChecksum,
  type SchemaMigrationAdapterScope,
  type SchemaMigrationForwardOperation,
} from '../../schema-engine/migrations.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemorySchemaMigrationRepository } from './repository.js'
import type { SchemaMigrationRecord } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const
const ctxB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' } as const
const userId = 'user_01ARYZ6S41YYYYYYYYYYYYYYYY'
const adapter = { name: 'sqlite', dialect: 'sqlite' } satisfies SchemaMigrationAdapterScope
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
    id: userId,
    organizationId: ctx.orgId,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    avatarUrl: null,
    externalAuthId: null,
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
  }])
}

function makeRecord(overrides: Partial<SchemaMigrationRecord> = {}): SchemaMigrationRecord {
  const organizationId = overrides.organizationId ?? ctx.orgId
  const operations = overrides.forwardOperations ?? forwardOperations
  return {
    id: generateId('migration'),
    organizationId,
    checksum: computeSchemaMigrationChecksum({ adapter, orgId: organizationId, operations }),
    adapter,
    description: 'Add priority custom field',
    entityType: 'contacts',
    operationType: 'custom_field_add',
    forwardOperations: operations,
    reverseOperations,
    destructive: false,
    status: 'applied',
    sqlStatements: [],
    rollbackStatements: [],
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

describe('in-memory schema migration repository', () => {
  it('validates migration users against the request organization on create', async () => {
    const repository = createInMemorySchemaMigrationRepository([], { users: createUsersForOrg() })

    await expect(repository.create(ctx, makeRecord({
      appliedByUserId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
    }))).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('does not return another organization migration by id', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const record = makeRecord()
    await repository.create(ctx, record)

    await expect(repository.get(ctxB, record.id)).resolves.toBeNull()
  })

  it('lists only migrations in the request organization', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const record = makeRecord()
    const otherOrgRecord = makeRecord({
      id: generateId('migration'),
      organizationId: ctxB.orgId,
      appliedByUserId: null,
      appliedBy: null,
    })
    await repository.create(ctx, record)
    await repository.create(ctxB, otherOrgRecord)

    const result = await repository.list(ctx, { limit: 10 })

    expect(result.data.map((migration) => migration.id)).toEqual([record.id])
  })

  it('updates status from pending to applied and refuses cross-org updates', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const record = makeRecord({ status: 'pending', startedAt: null, appliedAt: null })
    await repository.create(ctx, record)

    const appliedAt = new Date('2026-04-02T12:05:00.000Z')
    const updated = await repository.updateStatus(ctx, record.id, {
      status: 'applied',
      appliedAt,
    })
    expect(updated?.status).toBe('applied')
    expect(updated?.appliedAt?.toISOString()).toBe(appliedAt.toISOString())

    await expect(repository.updateStatus(ctxB, record.id, {
      status: 'failed',
      failedAt: new Date(),
    })).resolves.toBeNull()
    const reread = await repository.get(ctx, record.id)
    expect(reread?.status).toBe('applied')
  })

  it('rejects rollback preconditions for non-applied migrations', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const record = makeRecord({ status: 'pending', appliedAt: null })
    await repository.create(ctx, record)

    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: record.id,
      adapter,
    })).rejects.toMatchObject({ code: 'ROLLBACK_PRECONDITION_FAILED' })
  })

  it('rejects rollback when a newer applied migration overlaps the same target', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const older = makeRecord()
    const newer = makeRecord({
      id: generateId('migration'),
      appliedAt: new Date('2026-04-03T12:00:00.000Z'),
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      updatedAt: new Date('2026-04-03T12:00:00.000Z'),
    })
    await repository.create(ctx, older)
    await repository.create(ctx, newer)

    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: older.id,
      adapter,
    })).rejects.toMatchObject({ code: 'ROLLBACK_PRECONDITION_FAILED' })

    await expect(repository.assertRollbackPreconditions(ctx, {
      migrationId: newer.id,
      adapter,
    })).resolves.toMatchObject({ id: newer.id })
  })

  it('serializes concurrent migrations on the same lock key with MIGRATION_CONFLICT', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const scope = { adapter, target: 'contacts.priority' }

    let releaseFirst: () => void = () => {}
    const firstHolds = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const first = repository.withMigrationLock(ctx, scope, async () => {
      await firstHolds
      return 'first'
    })

    await expect(repository.withMigrationLock(ctx, scope, async () => 'second'))
      .rejects.toMatchObject({ code: 'MIGRATION_CONFLICT', retryable: true })

    releaseFirst()
    const { result, lock } = await first
    expect(result).toBe('first')
    expect(lock.released).toBe(true)

    // Once released, the same key is acquirable again.
    await expect(repository.withMigrationLock(ctx, scope, async () => 'third'))
      .resolves.toMatchObject({ result: 'third' })
  })
})
