import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool } from './schemas.js'
import { toToolSuccess } from '../errors.js'
import { getClientResource } from './core-records.js'

const AssignRecordInput = z.object({
  object_type: z.enum(['contacts', 'companies', 'deals', 'tasks']),
  record_id: z.string(),
  user_id: z.string(),
})

export const assignRecordTool = defineTool({
  name: 'assign_record',
  title: 'Assign an Orbit record',
  description:
    'Use this to set the assignee on contacts, companies, deals, or tasks when you know both IDs. Do not use it for unsupported entity types.',
  inputSchema: AssignRecordInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export async function handleAssignRecord(client: OrbitClient, rawArgs: unknown) {
  const args = AssignRecordInput.parse(rawArgs)
  return toToolSuccess(
    await getClientResource(client, args.object_type).update(args.record_id, {
      assigned_to_user_id: args.user_id,
    }),
  )
}
