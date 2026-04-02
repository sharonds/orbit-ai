import { z } from 'zod'

import { tagInsertSchema, tagSelectSchema, tagUpdateSchema } from '../../schema/zod.js'

export const tagRecordSchema = tagSelectSchema
export type TagRecord = z.infer<typeof tagRecordSchema>

export const tagCreateInputSchema = tagInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type TagCreateInput = z.input<typeof tagCreateInputSchema>

export const tagUpdateInputSchema = tagUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type TagUpdateInput = z.input<typeof tagUpdateInputSchema>
