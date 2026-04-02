import { z } from 'zod'

import { importInsertSchema, importSelectSchema, importUpdateSchema } from '../../schema/zod.js'

const importStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed'])

export const importRecordSchema = importSelectSchema.extend({
  status: importStatusSchema,
})
export type ImportRecord = z.infer<typeof importRecordSchema>

export const importCreateInputSchema = importInsertSchema.omit({
  createdRows: true,
  updatedRows: true,
  skippedRows: true,
  failedRows: true,
  status: true,
  rollbackData: true,
  id: true,
  organizationId: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
})
export type ImportCreateInput = z.input<typeof importCreateInputSchema>

export const importUpdateInputSchema = importUpdateSchema.omit({
  id: true,
  organizationId: true,
  rollbackData: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: importStatusSchema.optional(),
})
export type ImportUpdateInput = z.input<typeof importUpdateInputSchema>
