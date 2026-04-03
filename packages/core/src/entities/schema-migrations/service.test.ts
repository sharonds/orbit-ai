import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemorySchemaMigrationRepository } from './repository.js'
import { createSchemaMigrationAdminService } from './service.js'
import type { SchemaMigrationRecord } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const
const ctxB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' } as const
const userId = 'user_01ARYZ6S41YYYYYYYYYYYYYYYY'

function createUsersForOrg() {
  return createInMemoryUserRepository([{
    id: userId, organizationId: ctx.orgId, email: 'admin@example.com', name: 'Admin',
    role: 'admin', avatarUrl: null, externalAuthId: null, isActive: true, metadata: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'), updatedAt: new Date('2026-04-02T12:00:00.000Z'),
  }])
}

function makeRecord(overrides: Partial<SchemaMigrationRecord> = {}): SchemaMigrationRecord {
  return {
    id: generateId('migration'),
    organizationId: ctx.orgId,
    description: 'Add priority column to contacts',
    entityType: 'contacts',
    operationType: 'add_column',
    sqlStatements: ['ALTER TABLE contacts ADD COLUMN priority TEXT'],
    rollbackStatements: ['ALTER TABLE contacts DROP COLUMN priority'],
    appliedByUserId: userId,
    approvedByUserId: null,
    appliedAt: new Date('2026-04-02T12:00:00.000Z'),
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

  it('stores migration SQL arrays while sanitizing them from admin reads', async () => {
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
    expect(stored!.sqlStatements).toEqual(sqlStatements)
    expect(stored!.rollbackStatements).toEqual(rollbackStatements)

    const found = await service.get(ctx, record.id)
    expect(found).not.toBeNull()
    expect('sqlStatements' in found!).toBe(false)
    expect('rollbackStatements' in found!).toBe(false)
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
})
