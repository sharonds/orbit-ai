import { z } from 'zod'

import { sequenceEventInsertSchema, sequenceEventSelectSchema } from '../../schema/zod.js'

export const sequenceEventRecordSchema = sequenceEventSelectSchema
export type SequenceEventRecord = z.infer<typeof sequenceEventRecordSchema>

export const sequenceEventCreateInputSchema = sequenceEventInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceEventCreateInput = z.input<typeof sequenceEventCreateInputSchema>
