import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryWebhookDeliveryRepository } from './repository.js'
import { createWebhookDeliveryAdminService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

describe('webhook delivery admin service', () => {
  it('lists deliveries within org scope', async () => {
    const repository = createInMemoryWebhookDeliveryRepository()
    const service = createWebhookDeliveryAdminService(repository)

    await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      status: 'delivered',
      responseStatus: 200,
      attemptCount: 1,
      nextAttemptAt: null,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.eventType).toBe('contact.created')
  })

  it('gets a single delivery by id', async () => {
    const repository = createInMemoryWebhookDeliveryRepository()
    const service = createWebhookDeliveryAdminService(repository)

    const record = await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      status: 'delivered',
      responseStatus: 200,
      attemptCount: 1,
      nextAttemptAt: null,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
  })

  it('tenant isolation: org B cannot see org A deliveries', async () => {
    const repository = createInMemoryWebhookDeliveryRepository()
    const service = createWebhookDeliveryAdminService(repository)

    const record = await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      status: 'delivered',
      responseStatus: 200,
      attemptCount: 1,
      nextAttemptAt: null,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    expect(await service.get(ctxB, record.id)).toBeNull()
    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('rejects duplicate (webhookId, eventId) via repository', async () => {
    const repository = createInMemoryWebhookDeliveryRepository()

    await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      status: 'pending',
      responseStatus: null,
      attemptCount: 0,
      nextAttemptAt: null,
      deliveredAt: null,
      lastError: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.create(ctx, {
        id: generateId('webhookDelivery'),
        organizationId: ctx.orgId,
        webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
        eventId: 'evt_123',
        eventType: 'contact.created',
        status: 'pending',
        responseStatus: null,
        attemptCount: 0,
        nextAttemptAt: null,
        deliveredAt: null,
        lastError: null,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('only exposes list and get methods on the admin service', () => {
    const repository = createInMemoryWebhookDeliveryRepository()
    const service = createWebhookDeliveryAdminService(repository)

    expect('list' in service).toBe(true)
    expect('get' in service).toBe(true)
    expect('create' in service).toBe(false)
    expect('update' in service).toBe(false)
    expect('delete' in service).toBe(false)
  })
})
