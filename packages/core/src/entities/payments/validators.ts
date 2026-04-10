import { z } from 'zod'

import { paymentInsertSchema, paymentSelectSchema, paymentUpdateSchema } from '../../schema/zod.js'

export const paymentRecordSchema = paymentSelectSchema
export type PaymentRecord = z.infer<typeof paymentRecordSchema>

export const paymentCreateInputSchema = paymentInsertSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  })
  .transform((data) => {
    if (data.payment_method !== undefined && data.method === undefined) {
      const { payment_method, ...rest } = data
      return { ...rest, method: payment_method }
    }
    const { payment_method: _pm, ...rest } = data
    return rest
  })
export type PaymentCreateInput = z.input<typeof paymentCreateInputSchema>

export const paymentUpdateInputSchema = paymentUpdateSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  })
  .transform((data) => {
    if (data.payment_method !== undefined && data.method === undefined) {
      const { payment_method, ...rest } = data
      return { ...rest, method: payment_method }
    }
    const { payment_method: _pm, ...rest } = data
    return rest
  })
export type PaymentUpdateInput = z.input<typeof paymentUpdateInputSchema>
