import { z } from 'zod'

import { webhookDeliveryInsertSchema, webhookDeliverySelectSchema } from '../../schema/zod.js'

export const webhookDeliveryRecordSchema = webhookDeliverySelectSchema
export type WebhookDeliveryRecord = z.infer<typeof webhookDeliveryRecordSchema>

export const webhookDeliveryCreateInputSchema = webhookDeliveryInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type WebhookDeliveryCreateInput = z.input<typeof webhookDeliveryCreateInputSchema>
