import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { defineTool } from './schemas.js'
import { McpNotImplementedError, McpToolError, toToolSuccess } from '../errors.js'
import { sanitizeObjectDeep } from '../output/sensitive.js'
import { getClientResource } from './core-records.js'

const RelateRecordsInput = z.object({
  relationship_type: z.enum(['tag', 'contact_company', 'contact_deal', 'company_deal']),
  source_record_id: z.string(),
  target_record_id: z.string(),
  detach: z.boolean().optional(),
})

const ListRelatedRecordsInput = z.object({
  relationship_type: z.string(),
  source_record_id: z.string(),
})

export const relateRecordsTool = defineTool({
  name: 'relate_records',
  title: 'Relate Orbit records',
  description:
    'Use this to attach tags or set supported direct record relationships when both record IDs are already known. Do not use it to discover related records.',
  inputSchema: RelateRecordsInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const listRelatedRecordsTool = defineTool({
  name: 'list_related_records',
  title: 'List related Orbit records',
  description:
    'Use this only after Orbit exposes named relationship helpers in the SDK. Do not rely on it until that seam exists.',
  inputSchema: ListRelatedRecordsInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

function assertNeverRelationshipType(x: never): never {
  throw new McpToolError('UNSUPPORTED_OBJECT_TYPE', `Unsupported relationship type: ${String(x)}`)
}

export async function handleRelateRecords(client: OrbitClient, rawArgs: unknown) {
  const args = RelateRecordsInput.parse(rawArgs)

  if (args.relationship_type === 'tag') {
    const operation = args.detach ? 'detach' : 'attach'
    const data = await client.tags[operation]!(args.target_record_id, {
      entity_type: inferEntityType(args.source_record_id),
      entity_id: args.source_record_id,
    })
    return toToolSuccess(sanitizeObjectDeep(data))
  }

  if (args.relationship_type === 'contact_company') {
    return toToolSuccess(
      sanitizeObjectDeep(
        await getClientResource(client, 'contacts').update(args.source_record_id, {
          company_id: args.detach ? null : args.target_record_id,
        }),
      ),
    )
  }

  if (args.relationship_type === 'contact_deal') {
    return toToolSuccess(
      sanitizeObjectDeep(
        await getClientResource(client, 'deals').update(args.target_record_id, {
          contact_id: args.detach ? null : args.source_record_id,
        }),
      ),
    )
  }

  if (args.relationship_type === 'company_deal') {
    return toToolSuccess(
      sanitizeObjectDeep(
        await getClientResource(client, 'deals').update(args.target_record_id, {
          company_id: args.detach ? null : args.source_record_id,
        }),
      ),
    )
  }

  return assertNeverRelationshipType(args.relationship_type)
}

export async function handleListRelatedRecords(): Promise<CallToolResult> {
  throw new McpNotImplementedError()
}

function inferEntityType(recordId: string): string {
  if (recordId.startsWith('contact_')) return 'contacts'
  if (recordId.startsWith('company_')) return 'companies'
  if (recordId.startsWith('deal_')) return 'deals'
  if (recordId.startsWith('task_')) return 'tasks'
  throw new McpToolError(
    'VALIDATION_FAILED',
    `Unable to infer entity type from record ID ${recordId}. Provide a supported Orbit record ID prefix.`,
  )
}
