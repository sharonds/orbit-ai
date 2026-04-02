import type { AdminEntityService } from '../../services/entity-service.js'
import type { AuditLogRepository } from './repository.js'
import { sanitizeAuditLogRecord, type SanitizedAuditLogRecord } from './validators.js'

export function createAuditLogAdminService(
  repository: AuditLogRepository,
): AdminEntityService<SanitizedAuditLogRecord> {
  return {
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeAuditLogRecord),
      }
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeAuditLogRecord(record) : null
    },
  }
}
