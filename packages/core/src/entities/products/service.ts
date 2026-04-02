import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { ProductRepository } from './repository.js'
import {
  productCreateInputSchema,
  productRecordSchema,
  productUpdateInputSchema,
  type ProductCreateInput,
  type ProductRecord,
  type ProductUpdateInput,
} from './validators.js'

export function createProductService(deps: {
  products: ProductRepository
}): EntityService<ProductCreateInput, ProductUpdateInput, ProductRecord> {
  return {
    async create(ctx, input) {
      const parsed = productCreateInputSchema.parse(input)
      const now = new Date()

      return deps.products.create(
        ctx,
        productRecordSchema.parse({
          id: generateId('product'),
          organizationId: ctx.orgId,
          name: parsed.name,
          price: parsed.price,
          currency: parsed.currency ?? 'USD',
          description: parsed.description ?? null,
          isActive: parsed.isActive ?? true,
          sortOrder: parsed.sortOrder ?? 0,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.products.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = productUpdateInputSchema.parse(input)
      assertFound(await deps.products.get(ctx, id), `Product ${id} not found`)

      const patch: Partial<ProductRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.price !== undefined) patch.price = parsed.price
      if (parsed.currency !== undefined) patch.currency = parsed.currency
      if (parsed.description !== undefined) patch.description = parsed.description ?? null
      if (parsed.isActive !== undefined) patch.isActive = parsed.isActive
      if (parsed.sortOrder !== undefined) patch.sortOrder = parsed.sortOrder
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.products.update(ctx, id, patch), `Product ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.products.delete(ctx, id), `Product ${id} not found`)
    },
    async list(ctx, query) {
      return deps.products.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.products.search(ctx, query)
    },
  }
}
