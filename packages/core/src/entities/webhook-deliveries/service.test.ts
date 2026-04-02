import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryWebhookRepository } from '../webhooks/repository.js'
import { createInMemoryWebhookDeliveryRepository } from './repository.js'
import { createWebhookDeliveryAdminService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

function createRepositoryWithWebhooks() {
  const webhooks = createInMemoryWebhookRepository([
    {
      id: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      url: 'https://example.com/webhook',
      description: null,
      events: [],
      secretEncrypted: 'enc_value',
      secretLastFour: 'alue',
      secretCreatedAt: new Date('2026-04-02T12:00:00.000Z'),
      status: 'active',
      lastTriggeredAt: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    },
  ])

  return createInMemoryWebhookDeliveryRepository([], { webhooks })
}

describe('webhook delivery admin service', () => {
  it('lists deliveries within org scope', async () => {
    const repository = createRepositoryWithWebhooks()
    const service = createWebhookDeliveryAdminService(repository)

    await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      payload: { contactId: 'contact_123' },
      signature: 'sig_123',
      idempotencyKey: 'idem_123',
      status: 'succeeded',
      responseStatus: 200,
      responseBody: '{"ok":true}',
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
    expect('payload' in result.data[0]!).toBe(false)
    expect('signature' in result.data[0]!).toBe(false)
    expect('idempotencyKey' in result.data[0]!).toBe(false)
    expect('responseBody' in result.data[0]!).toBe(false)
  })

  it('gets a single delivery by id', async () => {
    const repository = createRepositoryWithWebhooks()
    const service = createWebhookDeliveryAdminService(repository)

    const record = await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      payload: { contactId: 'contact_123' },
      signature: 'sig_123',
      idempotencyKey: 'idem_123',
      status: 'succeeded',
      responseStatus: 200,
      responseBody: '{"ok":true}',
      attemptCount: 1,
      nextAttemptAt: null,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
    expect('payload' in fetched!).toBe(false)
    expect('signature' in fetched!).toBe(false)
    expect('idempotencyKey' in fetched!).toBe(false)
    expect('responseBody' in fetched!).toBe(false)
  })

  it('tenant isolation: org B cannot see org A deliveries', async () => {
    const repository = createRepositoryWithWebhooks()
    const service = createWebhookDeliveryAdminService(repository)

    const record = await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      payload: { contactId: 'contact_123' },
      signature: 'sig_123',
      idempotencyKey: 'idem_123',
      status: 'succeeded',
      responseStatus: 200,
      responseBody: '{"ok":true}',
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
    const repository = createRepositoryWithWebhooks()

    await repository.create(ctx, {
      id: generateId('webhookDelivery'),
      organizationId: ctx.orgId,
      webhookId: 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY',
      eventId: 'evt_123',
      eventType: 'contact.created',
      payload: { contactId: 'contact_123' },
      signature: 'sig_123',
      idempotencyKey: 'idem_123',
      status: 'pending',
      responseStatus: null,
      responseBody: null,
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
        payload: { contactId: 'contact_123' },
        signature: 'sig_456',
        idempotencyKey: 'idem_456',
        status: 'pending',
        responseStatus: null,
        responseBody: null,
        attemptCount: 0,
        nextAttemptAt: null,
        deliveredAt: null,
        lastError: null,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects cross-tenant webhook references when relation validation is available', async () => {
    const webhooks = createInMemoryWebhookRepository([
      {
        id: 'webhook_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
        organizationId: ctxB.orgId,
        url: 'https://example.com/other',
        description: null,
        events: [],
        secretEncrypted: 'enc_other',
        secretLastFour: 'ther',
        secretCreatedAt: new Date('2026-04-02T12:00:00.000Z'),
        status: 'active',
        lastTriggeredAt: null,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])
    const repository = createInMemoryWebhookDeliveryRepository([], { webhooks })

    await expect(
      repository.create(ctx, {
        id: generateId('webhookDelivery'),
        organizationId: ctx.orgId,
        webhookId: 'webhook_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
        eventId: 'evt_999',
        eventType: 'contact.created',
        payload: { contactId: 'contact_123' },
        signature: 'sig_999',
        idempotencyKey: 'idem_999',
        status: 'pending',
        responseStatus: null,
        responseBody: null,
        attemptCount: 0,
        nextAttemptAt: null,
        deliveredAt: null,
        lastError: null,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })
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
