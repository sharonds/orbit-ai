import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool, LimitSchema } from './schemas.js'
import { toToolSuccess } from '../errors.js'
import { sanitizeObjectDeep } from '../output/sensitive.js'
import { sanitizeStringInput, truncateUnknownStringsWithMeta } from '../output/truncation.js'

const LogActivityInput = z.object({
  type: z.string(),
  subject: z.string().optional(),
  body: z.string().optional(),
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  deal_id: z.string().optional(),
  logged_by_user_id: z.string().optional(),
  occurred_at: z.string(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
})

const ListActivitiesInput = z.object({
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  deal_id: z.string().optional(),
  logged_by_user_id: z.string().optional(),
  type: z.string().optional(),
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
  const parsed = LogActivityInput.safeParse(rawArgs)
  if (!parsed.success) {
    return toToolSuccess({ error: 'Invalid input', details: parsed.error.issues.map((i) => i.message).join('; ') })
  }
  const args = parsed.data
  return toToolSuccess(
    sanitizeObjectDeep(
      await client.activities.log({
        type: args.type,
        occurred_at: args.occurred_at,
        ...(args.subject ? { subject: sanitizeStringInput(args.subject) } : {}),
        ...(args.body ? { body: sanitizeStringInput(args.body) } : {}),
        ...(args.contact_id ? { contact_id: args.contact_id } : {}),
        ...(args.company_id ? { company_id: args.company_id } : {}),
        ...(args.deal_id ? { deal_id: args.deal_id } : {}),
        ...(args.logged_by_user_id ? { logged_by_user_id: args.logged_by_user_id } : {}),
        ...(args.custom_fields ? { custom_fields: args.custom_fields } : {}),
      }),
    ),
  )
}

export async function handleListActivities(client: OrbitClient, rawArgs: unknown) {
  const parsed = ListActivitiesInput.safeParse(rawArgs)
  if (!parsed.success) {
    return toToolSuccess({ error: 'Invalid input', details: parsed.error.issues.map((i) => i.message).join('; ') })
  }
  const args = parsed.data
  const raw = await client.activities.list({
    ...(args.contact_id ? { contact_id: args.contact_id } : {}),
    ...(args.company_id ? { company_id: args.company_id } : {}),
    ...(args.deal_id ? { deal_id: args.deal_id } : {}),
    ...(args.logged_by_user_id ? { logged_by_user_id: args.logged_by_user_id } : {}),
    ...(args.type ? { type: sanitizeStringInput(args.type) } : {}),
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    ...(args.cursor ? { cursor: args.cursor } : {}),
  })
  const sanitized = sanitizeObjectDeep(raw)
  const truncated = truncateUnknownStringsWithMeta(sanitized, 5_000)
  const wasTruncated = truncated.truncated || JSON.stringify(sanitized).includes('[truncated]')
  return toToolSuccess(truncated.value, wasTruncated ? { truncated: true } : undefined)
}
