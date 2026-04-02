import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryTagRepository } from './repository.js'
import { createTagService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

describe('tag service', () => {
  it('creates tags with name and optional color', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    const tag = await tagService.create(ctx, { name: 'VIP', color: '#ff0000' })

    expect(tag.name).toBe('VIP')
    expect(tag.color).toBe('#ff0000')
    expect(tag.organizationId).toBe(ctx.orgId)
  })

  it('enforces unique name per org', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    await tagService.create(ctx, { name: 'VIP' })

    await expect(tagService.create(ctx, { name: 'VIP' })).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'name',
    })
  })

  it('allows same tag name across different orgs', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    const tagA = await tagService.create(ctx, { name: 'VIP' })
    const tagB = await tagService.create(ctxB, { name: 'VIP' })

    expect(tagA.name).toBe('VIP')
    expect(tagB.name).toBe('VIP')
    expect(tagA.id).not.toBe(tagB.id)
  })

  it('searches tags by name and color', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    await tagService.create(ctx, { name: 'VIP', color: '#gold' })
    await tagService.create(ctx, { name: 'Prospect', color: '#blue' })

    const search = await tagService.search(ctx, { query: 'VIP', limit: 10 })
    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.name).toBe('VIP')
  })

  it('supports get, update, and delete lifecycle', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    const tag = await tagService.create(ctx, { name: 'VIP' })

    expect(await tagService.get(ctx, tag.id)).toMatchObject({ id: tag.id, name: 'VIP' })

    const updated = await tagService.update(ctx, tag.id, { color: '#gold' })
    expect(updated.color).toBe('#gold')

    await tagService.delete(ctx, tag.id)
    expect(await tagService.get(ctx, tag.id)).toBeNull()
  })

  it('rejects update to a name that already exists on a different tag', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    await tagService.create(ctx, { name: 'VIP' })
    const other = await tagService.create(ctx, { name: 'Prospect' })

    await expect(tagService.update(ctx, other.id, { name: 'VIP' })).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'name',
    })
  })

  it('allows updating a tag name to the same value', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    const tag = await tagService.create(ctx, { name: 'VIP' })

    const updated = await tagService.update(ctx, tag.id, { name: 'VIP', color: '#red' })
    expect(updated.name).toBe('VIP')
    expect(updated.color).toBe('#red')
  })

  it('tenant isolation: org B cannot see org A tags', async () => {
    const tagService = createTagService({ tags: createInMemoryTagRepository() })
    const tag = await tagService.create(ctx, { name: 'VIP' })

    expect(await tagService.get(ctxB, tag.id)).toBeNull()
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemoryTagRepository()
    const tag = await repository.create(ctx, {
      id: generateId('tag'),
      organizationId: ctx.orgId,
      name: 'VIP',
      color: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, tag.id, {
        organizationId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })
})
