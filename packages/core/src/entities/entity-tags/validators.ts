import { z } from 'zod'

import { entityTagInsertSchema, entityTagSelectSchema } from '../../schema/zod.js'

export const entityTagRecordSchema = entityTagSelectSchema
export type EntityTagRecord = z.infer<typeof entityTagRecordSchema>

export const entityTagCreateInputSchema = entityTagInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type EntityTagCreateInput = z.input<typeof entityTagCreateInputSchema>
