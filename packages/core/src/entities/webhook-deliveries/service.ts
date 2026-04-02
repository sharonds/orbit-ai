import type { AdminEntityService } from '../../services/entity-service.js'
import type { WebhookDeliveryRepository } from './repository.js'
import {
  sanitizeWebhookDeliveryRecord,
  type SanitizedWebhookDeliveryRecord,
} from './validators.js'

export function createWebhookDeliveryAdminService(
  repository: WebhookDeliveryRepository,
): AdminEntityService<SanitizedWebhookDeliveryRecord> {
  return {
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeWebhookDeliveryRecord),
      }
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeWebhookDeliveryRecord(record) : null
    },
  }
}
