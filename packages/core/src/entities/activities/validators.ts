import { z } from 'zod'

import { activityInsertSchema, activitySelectSchema, activityUpdateSchema } from '../../schema/zod.js'

export const activityRecordSchema = activitySelectSchema
export type ActivityRecord = z.infer<typeof activityRecordSchema>

export const activityCreateInputSchema = activityInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ActivityCreateInput = z.input<typeof activityCreateInputSchema>

export const activityUpdateInputSchema = activityUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ActivityUpdateInput = z.input<typeof activityUpdateInputSchema>
