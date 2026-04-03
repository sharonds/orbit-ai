import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemoryApiKeyRepository } from '../api-keys/repository.js'
import { createInMemoryAuditLogRepository } from './repository.js'
import { createAuditLogAdminService } from './service.js'
import type { AuditLogRecord } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const
const ctxB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' } as const
const userId = 'user_01ARYZ6S41YYYYYYYYYYYYYYYY'
const apiKeyId = 'key_01ARYZ6S41YYYYYYYYYYYYYYYY'

function createUsersForOrg() {
  return createInMemoryUserRepository([{
    id: userId,
    organizationId: ctx.orgId,
    email: 'actor@example.com',
    name: 'Actor',
    role: 'admin',
    avatarUrl: null,
    externalAuthId: null,
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
  }])
}

function createApiKeysForOrg() {
  return createInMemoryApiKeyRepository([{
    id: apiKeyId,
    organizationId: ctx.orgId,
    name: 'Test Key',
    keyHash: 'hash123',
    keyPrefix: 'orb_test_',
    scopes: ['*'],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdByUserId: userId,
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
  }])
}

function makeRecord(overrides: Partial<AuditLogRecord> = {}): AuditLogRecord {
  return {
    id: generateId('auditLog'),
    organizationId: ctx.orgId,
    actorUserId: userId,
    actorApiKeyId: null,
    entityType: 'contacts',
    entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
    action: 'create',
    before: null,
    after: { name: 'Alice', email: 'alice@example.com' },
    requestId: 'req_123',
    metadata: {},
    occurredAt: new Date('2026-04-02T12:00:00.000Z'),
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('audit log admin service', () => {
  it('lists audit logs within org scope', async () => {
    const record = makeRecord()
    const repository = createInMemoryAuditLogRepository([record])
    const service = createAuditLogAdminService(repository)

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe(record.id)
  })

  it('gets a single audit log by id', async () => {
    const record = makeRecord()
    const repository = createInMemoryAuditLogRepository([record])
    const service = createAuditLogAdminService(repository)

    const found = await service.get(ctx, record.id)
    expect(found?.id).toBe(record.id)
  })

  it('tenant isolation: org B cannot see org A audit logs', async () => {
    const record = makeRecord()
    const repository = createInMemoryAuditLogRepository([record])
    const service = createAuditLogAdminService(repository)

    const result = await service.list(ctxB, { limit: 10 })
    expect(result.data).toHaveLength(0)

    const found = await service.get(ctxB, record.id)
    expect(found).toBeNull()
  })

  it('sanitizes before and after fields from admin list reads', async () => {
    const record = makeRecord({
      before: { name: 'Old Name' },
      after: { name: 'New Name' },
    })
    const repository = createInMemoryAuditLogRepository([record])
    const service = createAuditLogAdminService(repository)

    const result = await service.list(ctx, { limit: 10 })
    expect('before' in result.data[0]!).toBe(false)
    expect('after' in result.data[0]!).toBe(false)
  })

  it('sanitizes before and after from get reads', async () => {
    const record = makeRecord({
      before: { name: 'Old Name' },
      after: { name: 'New Name' },
    })
    const repository = createInMemoryAuditLogRepository([record])
    const service = createAuditLogAdminService(repository)

    const found = await service.get(ctx, record.id)
    expect('before' in found!).toBe(false)
    expect('after' in found!).toBe(false)
  })

  it('validates same-tenant actor user reference', async () => {
    const users = createUsersForOrg()
    const repository = createInMemoryAuditLogRepository([], { users })
    const service = createAuditLogAdminService(repository)

    // cross-tenant user should throw RELATION_NOT_FOUND
    const record = makeRecord({ organizationId: ctxB.orgId, actorUserId: userId })
    await expect(
      repository.create(ctxB, record),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
      message: `Actor user ${userId} not found in this organization`,
    })

    // listing for ctxB still works (empty)
    const result = await service.list(ctxB, { limit: 10 })
    expect(result.data).toHaveLength(0)
  })

  it('validates same-tenant actor API key reference', async () => {
    const apiKeys = createApiKeysForOrg()
    const repository = createInMemoryAuditLogRepository([], { apiKeys })

    // cross-tenant api key should throw RELATION_NOT_FOUND
    const record = makeRecord({ organizationId: ctxB.orgId, actorUserId: null, actorApiKeyId: apiKeyId })
    await expect(
      repository.create(ctxB, record),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
      message: `Actor API key ${apiKeyId} not found in this organization`,
    })
  })

  it('preserves metadata and requestId through reads', async () => {
    const record = makeRecord({
      requestId: 'req_abc123',
      metadata: { source: 'test', version: 2 },
    })
    const repository = createInMemoryAuditLogRepository([record])
    const service = createAuditLogAdminService(repository)

    const found = await service.get(ctx, record.id)
    expect(found?.requestId).toBe('req_abc123')
    expect(found?.metadata).toEqual({ source: 'test', version: 2 })
  })
})
