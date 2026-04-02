import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryProductRepository } from './repository.js'
import { createProductService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('product service', () => {
  it('preserves catalog ordering and active state', async () => {
    const productService = createProductService({
      products: createInMemoryProductRepository(),
    })

    const inactive = await productService.create(ctx, {
      name: 'Onboarding',
      price: '49.00',
      sortOrder: 2,
      isActive: false,
    })
    await productService.create(ctx, {
      name: 'Platform',
      price: '199.00',
      sortOrder: 1,
    })

    const listed = await productService.list(ctx, { limit: 10 })

    expect(listed.data.map((record) => record.name)).toEqual(['Platform', 'Onboarding'])
    expect(inactive.isActive).toBe(false)
  })

  it('searches products by catalog text fields', async () => {
    const productService = createProductService({
      products: createInMemoryProductRepository(),
    })

    await productService.create(ctx, {
      name: 'Platform',
      price: '199.00',
      description: 'Full CRM infrastructure plan',
    })
    await productService.create(ctx, {
      name: 'Starter',
      price: '49.00',
      description: 'Small-team entry tier',
    })

    const search = await productService.search(ctx, {
      query: 'infrastructure',
      limit: 10,
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.name).toBe('Platform')
  })

  it('supports get, update, and delete for catalog records', async () => {
    const productService = createProductService({
      products: createInMemoryProductRepository(),
    })
    const product = await productService.create(ctx, {
      name: 'Starter',
      price: '49.00',
    })

    expect(await productService.get(ctx, product.id)).toMatchObject({
      id: product.id,
      name: 'Starter',
    })

    const updated = await productService.update(ctx, product.id, {
      isActive: false,
      sortOrder: 5,
    })

    expect(updated.isActive).toBe(false)
    expect(updated.sortOrder).toBe(5)

    await productService.delete(ctx, product.id)
    expect(await productService.get(ctx, product.id)).toBeNull()
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemoryProductRepository()
    const product = await repository.create(ctx, {
      id: generateId('product'),
      organizationId: ctx.orgId,
      name: 'Starter',
      price: '49.00',
      currency: 'USD',
      description: null,
      isActive: true,
      sortOrder: 0,
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, product.id, {
        organizationId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })
})
