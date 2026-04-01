import { z } from 'zod'

import { contactInsertSchema, contactSelectSchema, contactUpdateSchema } from '../../schema/zod.js'

export const contactRecordSchema = contactSelectSchema
export type ContactRecord = z.infer<typeof contactRecordSchema>

export const contactCreateInputSchema = contactInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ContactCreateInput = z.input<typeof contactCreateInputSchema>

export const contactUpdateInputSchema = contactUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ContactUpdateInput = z.input<typeof contactUpdateInputSchema>
