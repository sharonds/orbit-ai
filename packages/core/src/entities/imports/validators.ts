import { z } from 'zod'

import { importInsertSchema, importSelectSchema, importUpdateSchema } from '../../schema/zod.js'

export const importRecordSchema = importSelectSchema
export type ImportRecord = z.infer<typeof importRecordSchema>

export const importCreateInputSchema = importInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ImportCreateInput = z.input<typeof importCreateInputSchema>

export const importUpdateInputSchema = importUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ImportUpdateInput = z.input<typeof importUpdateInputSchema>
