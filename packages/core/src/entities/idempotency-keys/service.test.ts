import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryIdempotencyKeyRepository } from './repository.js'
import { createIdempotencyKeyAdminService } from './service.js'
import type { IdempotencyKeyRecord } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const
const ctxB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' } as const

function makeRecord(overrides: Partial<IdempotencyKeyRecord> = {}): IdempotencyKeyRecord {
  return {
    id: generateId('idempotencyKey'),
    organizationId: ctx.orgId,
    key: 'idem_abc123',
    method: 'POST',
    path: '/api/v1/contacts',
    requestHash: 'sha256_deadbeef',
    responseCode: 201,
    responseBody: { id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    lockedUntil: null,
    completedAt: new Date('2026-04-02T12:00:00.000Z'),
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('idempotency key admin service', () => {
  it('lists idempotency keys within org scope', async () => {
    const record = makeRecord()
    const repository = createInMemoryIdempotencyKeyRepository([record])
    const service = createIdempotencyKeyAdminService(repository)

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe(record.id)
  })

  it('gets a single idempotency key by id', async () => {
    const record = makeRecord()
    const repository = createInMemoryIdempotencyKeyRepository([record])
    const service = createIdempotencyKeyAdminService(repository)

    const found = await service.get(ctx, record.id)
    expect(found?.id).toBe(record.id)
  })

  it('tenant isolation: org B cannot see org A idempotency keys', async () => {
    const record = makeRecord()
    const repository = createInMemoryIdempotencyKeyRepository([record])
    const service = createIdempotencyKeyAdminService(repository)

    const result = await service.list(ctxB, { limit: 10 })
    expect(result.data).toHaveLength(0)

    const found = await service.get(ctxB, record.id)
    expect(found).toBeNull()
  })

  it('rejects duplicate (organizationId, key, method, path) — CONFLICT', async () => {
    const record = makeRecord()
    const repository = createInMemoryIdempotencyKeyRepository([record])

    const duplicate = makeRecord({ id: generateId('idempotencyKey') })
    await expect(
      repository.create(ctx, duplicate),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('allows same key for different methods', async () => {
    const record = makeRecord({ method: 'POST' })
    const repository = createInMemoryIdempotencyKeyRepository([record])

    const different = makeRecord({
      id: generateId('idempotencyKey'),
      method: 'PUT',
    })
    const created = await repository.create(ctx, different)
    expect(created.id).toBe(different.id)
  })

  it('sanitizes requestHash and responseBody from admin list reads', async () => {
    const record = makeRecord({
      requestHash: 'sha256_deadbeef',
      responseBody: { id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    })
    const repository = createInMemoryIdempotencyKeyRepository([record])
    const service = createIdempotencyKeyAdminService(repository)

    const result = await service.list(ctx, { limit: 10 })
    expect('requestHash' in result.data[0]!).toBe(false)
    expect('responseBody' in result.data[0]!).toBe(false)
  })

  it('sanitizes requestHash and responseBody from admin get reads', async () => {
    const record = makeRecord({
      requestHash: 'sha256_deadbeef',
      responseBody: { id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    })
    const repository = createInMemoryIdempotencyKeyRepository([record])
    const service = createIdempotencyKeyAdminService(repository)

    const found = await service.get(ctx, record.id)
    expect('requestHash' in found!).toBe(false)
    expect('responseBody' in found!).toBe(false)
  })

  it('preserves lifecycle metadata (lockedUntil, completedAt)', async () => {
    const lockedUntil = new Date('2026-04-02T13:00:00.000Z')
    const completedAt = new Date('2026-04-02T12:30:00.000Z')
    const record = makeRecord({ lockedUntil, completedAt })
    const repository = createInMemoryIdempotencyKeyRepository([record])
    const service = createIdempotencyKeyAdminService(repository)

    const found = await service.get(ctx, record.id)
    expect(found?.lockedUntil).toEqual(lockedUntil)
    expect(found?.completedAt).toEqual(completedAt)
  })
})
