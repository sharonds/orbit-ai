import { z } from 'zod'

import { sequenceInsertSchema, sequenceSelectSchema, sequenceUpdateSchema } from '../../schema/zod.js'

export const sequenceRecordSchema = sequenceSelectSchema
export type SequenceRecord = z.infer<typeof sequenceRecordSchema>

export const sequenceCreateInputSchema = sequenceInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceCreateInput = z.input<typeof sequenceCreateInputSchema>

export const sequenceUpdateInputSchema = sequenceUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceUpdateInput = z.input<typeof sequenceUpdateInputSchema>
