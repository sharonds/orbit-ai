import { z } from 'zod'

import { paymentInsertSchema, paymentSelectSchema, paymentUpdateSchema } from '../../schema/zod.js'

export const paymentRecordSchema = paymentSelectSchema
export type PaymentRecord = z.infer<typeof paymentRecordSchema>

export const paymentCreateInputSchema = paymentInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type PaymentCreateInput = z.input<typeof paymentCreateInputSchema>

export const paymentUpdateInputSchema = paymentUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type PaymentUpdateInput = z.input<typeof paymentUpdateInputSchema>
