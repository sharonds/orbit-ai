import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool, LimitSchema } from './schemas.js'
import { toToolSuccess } from '../errors.js'
import { sanitizeStringInput, truncateUnknownStrings } from '../output/truncation.js'

const LogActivityInput = z.object({
  type: z.string(),
  subject: z.string().optional(),
  description: z.string().optional(),
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  deal_id: z.string().optional(),
  user_id: z.string().optional(),
  occurred_at: z.string(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
})

const ListActivitiesInput = z.object({
  limit: LimitSchema,
  cursor: z.string().optional(),
})

export const logActivityTool = defineTool({
  name: 'log_activity',
  title: 'Log an Orbit activity',
  description:
    'Use this to create a real activity log entry with a type and occurred_at timestamp. Do not use generic create_record for this workflow.',
  inputSchema: LogActivityInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const listActivitiesTool = defineTool({
  name: 'list_activities',
  title: 'List Orbit activities',
  description:
    'Use this to inspect recent activities. Do not use it when you need a specific activity by ID.',
  inputSchema: ListActivitiesInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export async function handleLogActivity(client: OrbitClient, rawArgs: unknown) {
  const args = LogActivityInput.parse(rawArgs)
  return toToolSuccess(
    await client.activities.log({
      type: args.type,
      occurred_at: args.occurred_at,
      ...(args.subject ? { subject: sanitizeStringInput(args.subject) } : {}),
      ...(args.description ? { description: sanitizeStringInput(args.description) } : {}),
      ...(args.contact_id ? { contact_id: args.contact_id } : {}),
      ...(args.company_id ? { company_id: args.company_id } : {}),
      ...(args.deal_id ? { deal_id: args.deal_id } : {}),
      ...(args.user_id ? { user_id: args.user_id } : {}),
      ...(args.custom_fields ? { custom_fields: args.custom_fields } : {}),
    }),
  )
}

export async function handleListActivities(client: OrbitClient, rawArgs: unknown) {
  const args = ListActivitiesInput.parse(rawArgs)
  const result = await client.activities.list({
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    ...(args.cursor ? { cursor: args.cursor } : {}),
  })
  return toToolSuccess(truncateUnknownStrings(result, 5_000))
}
