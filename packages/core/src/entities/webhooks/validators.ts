import { z } from 'zod'

import { webhookInsertSchema, webhookSelectSchema, webhookUpdateSchema } from '../../schema/zod.js'

const webhookStatusSchema = z.enum(['active', 'disabled'])
const storedWebhookStatusSchema = z.enum(['active', 'disabled', 'inactive', 'failed'])

export const webhookRecordSchema = webhookSelectSchema.extend({
  status: webhookStatusSchema,
})
export type WebhookRecord = z.infer<typeof webhookRecordSchema>
export type LegacyWebhookRecord = Omit<WebhookRecord, 'status'> & {
  status: 'inactive' | 'failed'
}

export function normalizeStoredWebhookStatus(status: unknown): WebhookRecord['status'] {
  const parsed = storedWebhookStatusSchema.parse(status)
  return parsed === 'active' ? 'active' : 'disabled'
}

export function parseStoredWebhookRecord(
  record: Record<string, unknown> & { status: unknown },
): WebhookRecord {
  return webhookRecordSchema.parse({
    ...record,
    status: normalizeStoredWebhookStatus(record.status),
  })
}

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
