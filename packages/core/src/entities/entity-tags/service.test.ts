import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryEntityTagRepository } from './repository.js'
import { createEntityTagAdminService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

describe('entity tag admin service', () => {
  it('lists entity tags within org scope', async () => {
    const repository = createInMemoryEntityTagRepository()
    const service = createEntityTagAdminService(repository)

    await repository.create(ctx, {
      id: generateId('entityTag'),
      organizationId: ctx.orgId,
      tagId: 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY',
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.entityType).toBe('contacts')
  })

  it('gets a single entity tag by id', async () => {
    const repository = createInMemoryEntityTagRepository()
    const service = createEntityTagAdminService(repository)

    const record = await repository.create(ctx, {
      id: generateId('entityTag'),
      organizationId: ctx.orgId,
      tagId: 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY',
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
  })

  it('tenant isolation: org B cannot see org A entity tags', async () => {
    const repository = createInMemoryEntityTagRepository()
    const service = createEntityTagAdminService(repository)

    const record = await repository.create(ctx, {
      id: generateId('entityTag'),
      organizationId: ctx.orgId,
      tagId: 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY',
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    expect(await service.get(ctxB, record.id)).toBeNull()
    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('rejects duplicate (orgId, tagId, entityType, entityId) joins', async () => {
    const repository = createInMemoryEntityTagRepository()

    await repository.create(ctx, {
      id: generateId('entityTag'),
      organizationId: ctx.orgId,
      tagId: 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY',
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.create(ctx, {
        id: generateId('entityTag'),
        organizationId: ctx.orgId,
        tagId: 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY',
        entityType: 'contacts',
        entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('supports lookup by entity_type and entity_id filter', async () => {
    const repository = createInMemoryEntityTagRepository()
    const service = createEntityTagAdminService(repository)

    await repository.create(ctx, {
      id: generateId('entityTag'),
      organizationId: ctx.orgId,
      tagId: 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY',
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })
    await repository.create(ctx, {
      id: generateId('entityTag'),
      organizationId: ctx.orgId,
      tagId: 'tag_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      entityType: 'deals',
      entityId: 'deal_01ARYZ6S41YYYYYYYYYYYYYYYY',
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const contactTags = await service.list(ctx, {
      filter: { entity_type: 'contacts' },
      limit: 10,
    })
    expect(contactTags.data).toHaveLength(1)
    expect(contactTags.data[0]?.entityType).toBe('contacts')
  })
})
