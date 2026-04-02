import { z } from 'zod'

import { noteInsertSchema, noteSelectSchema, noteUpdateSchema } from '../../schema/zod.js'

export const noteRecordSchema = noteSelectSchema
export type NoteRecord = z.infer<typeof noteRecordSchema>

export const noteCreateInputSchema = noteInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type NoteCreateInput = z.input<typeof noteCreateInputSchema>

export const noteUpdateInputSchema = noteUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type NoteUpdateInput = z.input<typeof noteUpdateInputSchema>
