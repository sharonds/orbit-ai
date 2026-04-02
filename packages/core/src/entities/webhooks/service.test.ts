import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryWebhookRepository } from './repository.js'
import { createWebhookService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

function createWebhookInput(overrides = {}) {
  return {
    url: 'https://example.com/webhook',
    secretEncrypted: 'enc_secret_value_123',
    secretLastFour: 'e123',
    events: ['contact.created', 'deal.updated'],
    description: 'Test webhook',
    ...overrides,
  }
}

describe('webhook service', () => {
  it('creates a webhook and returns sanitized record (no secretEncrypted)', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    const webhook = await webhookService.create(ctx, createWebhookInput())

    expect(webhook.url).toBe('https://example.com/webhook')
    expect(webhook.secretLastFour).toBe('e123')
    expect(webhook.status).toBe('active')
    expect('secretEncrypted' in webhook).toBe(false)
  })

  it('get returns sanitized record (no secretEncrypted)', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    const created = await webhookService.create(ctx, createWebhookInput())

    const fetched = await webhookService.get(ctx, created.id)
    expect(fetched).not.toBeNull()
    expect('secretEncrypted' in fetched!).toBe(false)
    expect(fetched!.secretLastFour).toBe('e123')
  })

  it('list returns sanitized records (no secretEncrypted in any item)', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    await webhookService.create(ctx, createWebhookInput())
    await webhookService.create(ctx, createWebhookInput({ url: 'https://example.com/hook2' }))

    const list = await webhookService.list(ctx, { limit: 10 })
    expect(list.data).toHaveLength(2)
    for (const item of list.data) {
      expect('secretEncrypted' in item).toBe(false)
    }
  })

  it('search returns sanitized records (no secretEncrypted)', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    await webhookService.create(ctx, createWebhookInput())

    const search = await webhookService.search(ctx, { query: 'example.com', limit: 10 })
    expect(search.data).toHaveLength(1)
    expect('secretEncrypted' in search.data[0]!).toBe(false)
  })

  it('update returns sanitized record', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    const webhook = await webhookService.create(ctx, createWebhookInput())

    const updated = await webhookService.update(ctx, webhook.id, { status: 'inactive' })
    expect(updated.status).toBe('inactive')
    expect('secretEncrypted' in updated).toBe(false)
  })

  it('delete works', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    const webhook = await webhookService.create(ctx, createWebhookInput())

    await webhookService.delete(ctx, webhook.id)
    expect(await webhookService.get(ctx, webhook.id)).toBeNull()
  })

  it('preserves url, description, events, secretLastFour, secretCreatedAt, status on reads', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    const webhook = await webhookService.create(ctx, createWebhookInput())

    expect(webhook.url).toBe('https://example.com/webhook')
    expect(webhook.description).toBe('Test webhook')
    expect(webhook.events).toEqual(['contact.created', 'deal.updated'])
    expect(webhook.secretLastFour).toBe('e123')
    expect(webhook.secretCreatedAt).toBeInstanceOf(Date)
    expect(webhook.status).toBe('active')
  })

  it('tenant isolation: org B cannot see org A webhooks', async () => {
    const webhookService = createWebhookService({ webhooks: createInMemoryWebhookRepository() })
    const webhook = await webhookService.create(ctx, createWebhookInput())

    expect(await webhookService.get(ctxB, webhook.id)).toBeNull()
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemoryWebhookRepository()
    const now = new Date('2026-04-02T12:00:00.000Z')
    const webhook = await repository.create(ctx, {
      id: generateId('webhook'),
      organizationId: ctx.orgId,
      url: 'https://example.com/webhook',
      description: null,
      events: [],
      secretEncrypted: 'enc_value',
      secretLastFour: 'alue',
      secretCreatedAt: now,
      status: 'active',
      lastTriggeredAt: null,
      createdAt: now,
      updatedAt: now,
    })

    await expect(
      repository.update(ctx, webhook.id, {
        organizationId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })
})
