import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemoryImportRepository } from './repository.js'
import { createImportService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

function createTestDeps() {
  const users = createInMemoryUserRepository([
    {
      id: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    },
  ])

  return {
    imports: createInMemoryImportRepository(),
    users,
  }
}

describe('import service', () => {
  it('creates an import with pending status and zeroed counters', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    expect(record.status).toBe('pending')
    expect(record.createdRows).toBe(0)
    expect(record.updatedRows).toBe(0)
    expect(record.skippedRows).toBe(0)
    expect(record.failedRows).toBe(0)
    expect(record.completedAt).toBeNull()
  })

  it('allows pending -> processing -> completed transitions', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    const processing = await importService.update(ctx, record.id, { status: 'processing' })
    expect(processing.status).toBe('processing')

    const completed = await importService.update(ctx, record.id, { status: 'completed' })
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).not.toBeNull()
  })

  it('allows pending -> processing -> failed transitions', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await importService.update(ctx, record.id, { status: 'processing' })
    const failed = await importService.update(ctx, record.id, { status: 'failed' })
    expect(failed.status).toBe('failed')
    expect(failed.completedAt).not.toBeNull()
  })

  it('auto-sets completedAt when transitioning to completed', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await importService.update(ctx, record.id, { status: 'processing' })
    const completed = await importService.update(ctx, record.id, { status: 'completed' })
    expect(completed.completedAt).toBeInstanceOf(Date)
  })

  it('rejects invalid status transitions', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await expect(
      importService.update(ctx, record.id, { status: 'completed' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    })
  })

  it('rejects completed -> processing transition', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await importService.update(ctx, record.id, { status: 'processing' })
    await importService.update(ctx, record.id, { status: 'completed' })

    await expect(
      importService.update(ctx, record.id, { status: 'processing' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('validates startedByUserId resolves in the same org', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
      startedByUserId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
    })

    expect(record.startedByUserId).toBe('user_01ARYZ6S41YYYYYYYYYYYYYYYY')
  })

  it('rejects unknown startedByUserId', async () => {
    const importService = createImportService(createTestDeps())

    await expect(
      importService.create(ctx, {
        entityType: 'contacts',
        fileName: 'contacts.csv',
        startedByUserId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('rejects update to a startedByUserId from another org', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await expect(
      importService.update(ctx, record.id, {
        startedByUserId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('supports list and search', async () => {
    const importService = createImportService(createTestDeps())
    await importService.create(ctx, { entityType: 'contacts', fileName: 'contacts.csv' })
    await importService.create(ctx, { entityType: 'deals', fileName: 'deals.csv' })

    const list = await importService.list(ctx, { limit: 10 })
    expect(list.data).toHaveLength(2)

    const search = await importService.search(ctx, { query: 'contacts', limit: 10 })
    expect(search.data).toHaveLength(1)
  })

  it('rejects negative row counters', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await importService.update(ctx, record.id, { status: 'processing' })

    await expect(
      importService.update(ctx, record.id, { createdRows: -1 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'createdRows',
    })
  })

  it('rejects completedAt while the import is still processing', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    await expect(
      importService.update(ctx, record.id, {
        status: 'processing',
        completedAt: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'completedAt',
    })
  })

  it('tenant isolation: org B cannot see org A imports', async () => {
    const importService = createImportService(createTestDeps())
    const record = await importService.create(ctx, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
    })

    expect(await importService.get(ctxB, record.id)).toBeNull()
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemoryImportRepository()
    const record = await repository.create(ctx, {
      id: generateId('importJob'),
      organizationId: ctx.orgId,
      entityType: 'contacts',
      fileName: 'contacts.csv',
      totalRows: 0,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      status: 'pending',
      rollbackData: {},
      startedByUserId: null,
      completedAt: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, record.id, {
        organizationId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })
})
