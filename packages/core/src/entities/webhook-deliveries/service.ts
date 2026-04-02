import type { AdminEntityService } from '../../services/entity-service.js'
import type { WebhookDeliveryRepository } from './repository.js'
import type { WebhookDeliveryRecord } from './validators.js'

export function createWebhookDeliveryAdminService(
  repository: WebhookDeliveryRepository,
): AdminEntityService<WebhookDeliveryRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
