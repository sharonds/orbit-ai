import { z } from 'zod'

import { webhookInsertSchema, webhookSelectSchema, webhookUpdateSchema } from '../../schema/zod.js'

export const webhookRecordSchema = webhookSelectSchema
export type WebhookRecord = z.infer<typeof webhookRecordSchema>

// Sanitized: omits secretEncrypted
export const sanitizedWebhookRecordSchema = webhookRecordSchema.omit({
  secretEncrypted: true,
})
export type SanitizedWebhookRecord = z.infer<typeof sanitizedWebhookRecordSchema>

export function sanitizeWebhookRecord(record: WebhookRecord): SanitizedWebhookRecord {
  return sanitizedWebhookRecordSchema.parse(record)
}

export const webhookCreateInputSchema = webhookInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type WebhookCreateInput = z.input<typeof webhookCreateInputSchema>

export const webhookUpdateInputSchema = webhookUpdateSchema.omit({
  id: true,
  organizationId: true,
  secretEncrypted: true,
  secretLastFour: true,
  secretCreatedAt: true,
  createdAt: true,
  updatedAt: true,
})
export type WebhookUpdateInput = z.input<typeof webhookUpdateInputSchema>
