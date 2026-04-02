import { z } from 'zod'

import { taskInsertSchema, taskSelectSchema, taskUpdateSchema } from '../../schema/zod.js'

export const taskRecordSchema = taskSelectSchema
export type TaskRecord = z.infer<typeof taskRecordSchema>

export const taskCreateInputSchema = taskInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type TaskCreateInput = z.input<typeof taskCreateInputSchema>

export const taskUpdateInputSchema = taskUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type TaskUpdateInput = z.input<typeof taskUpdateInputSchema>
