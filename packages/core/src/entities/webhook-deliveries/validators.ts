import { z } from 'zod'

import { webhookDeliveryInsertSchema, webhookDeliverySelectSchema } from '../../schema/zod.js'

const webhookDeliveryStatusSchema = z.enum(['pending', 'succeeded', 'failed'])

export const webhookDeliveryRecordSchema = webhookDeliverySelectSchema.extend({
  status: webhookDeliveryStatusSchema,
})
export type WebhookDeliveryRecord = z.infer<typeof webhookDeliveryRecordSchema>

export const sanitizedWebhookDeliveryRecordSchema = webhookDeliveryRecordSchema.omit({
  payload: true,
  signature: true,
  idempotencyKey: true,
  responseBody: true,
})
export type SanitizedWebhookDeliveryRecord = z.infer<typeof sanitizedWebhookDeliveryRecordSchema>

export function sanitizeWebhookDeliveryRecord(record: WebhookDeliveryRecord): SanitizedWebhookDeliveryRecord {
  return sanitizedWebhookDeliveryRecordSchema.parse(record)
}

export const webhookDeliveryCreateInputSchema = webhookDeliveryInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type WebhookDeliveryCreateInput = z.input<typeof webhookDeliveryCreateInputSchema>
