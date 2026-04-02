import { z } from 'zod'

import { productInsertSchema, productSelectSchema, productUpdateSchema } from '../../schema/zod.js'

export const productRecordSchema = productSelectSchema
export type ProductRecord = z.infer<typeof productRecordSchema>

export const productCreateInputSchema = productInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ProductCreateInput = z.input<typeof productCreateInputSchema>

export const productUpdateInputSchema = productUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ProductUpdateInput = z.input<typeof productUpdateInputSchema>
