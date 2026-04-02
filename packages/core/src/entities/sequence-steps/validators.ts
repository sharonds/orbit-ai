import { z } from 'zod'

import { sequenceStepInsertSchema, sequenceStepSelectSchema, sequenceStepUpdateSchema } from '../../schema/zod.js'

export const sequenceStepRecordSchema = sequenceStepSelectSchema
export type SequenceStepRecord = z.infer<typeof sequenceStepRecordSchema>

export const sequenceStepCreateInputSchema = sequenceStepInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceStepCreateInput = z.input<typeof sequenceStepCreateInputSchema>

export const sequenceStepUpdateInputSchema = sequenceStepUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceStepUpdateInput = z.input<typeof sequenceStepUpdateInputSchema>
