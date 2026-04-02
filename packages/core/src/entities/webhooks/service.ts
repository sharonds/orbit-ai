import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { WebhookRepository } from './repository.js'
import {
  sanitizeWebhookRecord,
  webhookCreateInputSchema,
  webhookRecordSchema,
  webhookUpdateInputSchema,
  type SanitizedWebhookRecord,
  type WebhookCreateInput,
  type WebhookRecord,
  type WebhookUpdateInput,
} from './validators.js'

export function createWebhookService(deps: {
  webhooks: WebhookRepository
}): EntityService<WebhookCreateInput, WebhookUpdateInput, SanitizedWebhookRecord> {
  return {
    async create(ctx, input) {
      const parsed = webhookCreateInputSchema.parse(input)
      const now = new Date()

      const record = await deps.webhooks.create(
        ctx,
        webhookRecordSchema.parse({
          id: generateId('webhook'),
          organizationId: ctx.orgId,
          url: parsed.url,
          description: parsed.description ?? null,
          events: parsed.events ?? [],
          secretEncrypted: parsed.secretEncrypted,
          secretLastFour: parsed.secretLastFour,
          secretCreatedAt: parsed.secretCreatedAt ?? now,
          status: parsed.status ?? 'active',
          lastTriggeredAt: null,
          createdAt: now,
          updatedAt: now,
        }),
      )

      return sanitizeWebhookRecord(record)
    },
    async get(ctx, id) {
      const record = await deps.webhooks.get(ctx, id)
      return record ? sanitizeWebhookRecord(record) : null
    },
    async update(ctx, id, input) {
      const parsed = webhookUpdateInputSchema.parse(input)
      assertFound(await deps.webhooks.get(ctx, id), `Webhook ${id} not found`)

      const patch: Partial<WebhookRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.url !== undefined) patch.url = parsed.url
      if (parsed.description !== undefined) patch.description = parsed.description ?? null
      if (parsed.events !== undefined) patch.events = parsed.events
      if (parsed.status !== undefined) patch.status = parsed.status
      if (parsed.lastTriggeredAt !== undefined) patch.lastTriggeredAt = parsed.lastTriggeredAt ?? null

      const updated = assertFound(await deps.webhooks.update(ctx, id, patch), `Webhook ${id} not found`)
      return sanitizeWebhookRecord(updated)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.webhooks.delete(ctx, id), `Webhook ${id} not found`)
    },
    async list(ctx, query) {
      const result = await deps.webhooks.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeWebhookRecord),
      }
    },
    async search(ctx, query) {
      const result = await deps.webhooks.search(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeWebhookRecord),
      }
    },
  }
}
