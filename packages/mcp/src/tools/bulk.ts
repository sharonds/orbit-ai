import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool, ObjectTypeSchema, sanitizeRecordPayload } from './schemas.js'
import { McpToolError, toToolSuccess } from '../errors.js'
import { getClientResource } from './core-records.js'
import { isDirectModeClient, writeDirectModeAuditLog } from '../server.js'
import { sanitizeObjectDeep } from '../output/sensitive.js'

const BulkOperationInput = z.object({
  object_type: ObjectTypeSchema,
  operations: z.array(
    z.discriminatedUnion('action', [
      z.object({ action: z.literal('create'), record: z.record(z.string(), z.unknown()) }),
      z.object({ action: z.literal('update'), record_id: z.string(), record: z.record(z.string(), z.unknown()) }),
      z.object({ action: z.literal('delete'), record_id: z.string(), confirm: z.literal(true) }),
    ]),
  ).max(100),
})

const BULK_SUPPORTED_TYPES = new Set([
  'contacts',
  'companies',
  'deals',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'tags',
])

export const bulkOperationTool = defineTool({
  name: 'bulk_operation',
  title: 'Run a bulk Orbit operation',
  description:
    'Use this for multiple create, update, or delete operations on a single supported object type. Do not use it for unsupported entities or when a semantic workflow tool exists.',
  inputSchema: BulkOperationInput,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
})

export async function handleBulkOperation(client: OrbitClient, rawArgs: unknown) {
  const args = BulkOperationInput.parse(rawArgs)

  if (!BULK_SUPPORTED_TYPES.has(args.object_type)) {
    throw new McpToolError('UNSUPPORTED_OBJECT_TYPE', `Bulk operations are not supported for ${args.object_type}.`)
  }

  if (isDirectModeClient(client)) {
    const deleteIds = args.operations.flatMap((operation) =>
      operation.action === 'delete' ? [operation.record_id] : [],
    )
    if (deleteIds.length > 0) {
      writeDirectModeAuditLog({
        kind: 'bulk_delete_preview',
        objectType: args.object_type,
        operationCount: args.operations.length,
        deleteIds,
      })
    }
  }

  const resource = getClientResource(client, args.object_type)
  const payload = {
    operations: args.operations.map((operation) =>
      'record' in operation
        ? { ...operation, record: sanitizeRecordPayload(operation.record) }
        : operation,
    ),
  }
  const rawResult = await resource.batch(payload)
  return toToolSuccess(sanitizeObjectDeep(rawResult))
}
