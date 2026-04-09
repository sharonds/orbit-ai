import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool, IncludeSchema, LimitSchema, SearchObjectTypeSchema, SortSchema, ObjectTypeSchema, CursorSchema, sanitizeRecordPayload } from './schemas.js'
import { toToolSuccess } from '../errors.js'
import { sanitizeSecretBearingRecord } from '../output/sensitive.js'
import { sanitizeStringInput } from '../output/truncation.js'
import { isDirectModeClient, validateWebhookUrlForDirectMode } from '../server.js'

const SearchRecordsInput = z.object({
  object_type: SearchObjectTypeSchema,
  query: z.string().optional(),
  filter: z.record(z.string(), z.unknown()).optional(),
  sort: SortSchema,
  limit: LimitSchema,
  cursor: CursorSchema,
  include: IncludeSchema,
})

const GetRecordInput = z.object({
  object_type: ObjectTypeSchema,
  record_id: z.string(),
  include: IncludeSchema,
})

const CreateRecordInput = z.object({
  object_type: ObjectTypeSchema,
  record: z.record(z.string(), z.unknown()),
  idempotency_key: z.string().optional(),
})

const UpdateRecordInput = z.object({
  object_type: ObjectTypeSchema,
  record_id: z.string(),
  record: z.record(z.string(), z.unknown()),
})

const DeleteRecordInput = z.object({
  object_type: ObjectTypeSchema,
  record_id: z.string(),
  confirm: z.literal(true),
})

export const RESOURCE_KEY_MAP = {
  contacts: 'contacts',
  companies: 'companies',
  deals: 'deals',
  pipelines: 'pipelines',
  stages: 'stages',
  activities: 'activities',
  tasks: 'tasks',
  notes: 'notes',
  products: 'products',
  payments: 'payments',
  contracts: 'contracts',
  sequences: 'sequences',
  sequence_steps: 'sequenceSteps',
  sequence_enrollments: 'sequenceEnrollments',
  sequence_events: 'sequenceEvents',
  tags: 'tags',
  webhooks: 'webhooks',
  users: 'users',
  imports: 'imports',
} as const

export type ResourceObjectType = keyof typeof RESOURCE_KEY_MAP
type ResourceKey = (typeof RESOURCE_KEY_MAP)[ResourceObjectType]

export const searchRecordsTool = defineTool({
  name: 'search_records',
  title: 'Search Orbit records',
  description:
    'Use this to discover records by text or filters when you do not already know the record ID. Do not use this when you already have an exact ID; use get_record instead.',
  inputSchema: SearchRecordsInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export const getRecordTool = defineTool({
  name: 'get_record',
  title: 'Get one Orbit record',
  description:
    'Use this only when you already know the exact Orbit record ID. Do not use this for discovery or broad filtering.',
  inputSchema: GetRecordInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export const createRecordTool = defineTool({
  name: 'create_record',
  title: 'Create an Orbit record',
  description:
    'Use this to create a single Orbit record when you already know the target object type. Do not use this for schema changes or batch work.',
  inputSchema: CreateRecordInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const updateRecordTool = defineTool({
  name: 'update_record',
  title: 'Update an Orbit record',
  description:
    'Use this to patch a known Orbit record by ID. Do not use this to move a deal stage or manage schema metadata when a semantic tool exists.',
  inputSchema: UpdateRecordInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const deleteRecordTool = defineTool({
  name: 'delete_record',
  title: 'Delete an Orbit record',
  description:
    'Use this only for permanent record deletion and only after confirming the exact record ID. Do not use it for reversible workflow changes.',
  inputSchema: DeleteRecordInput.partial({ confirm: true }),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
})

export async function handleSearchRecords(client: OrbitClient, rawArgs: unknown) {
  const args = SearchRecordsInput.parse(rawArgs)
  const query = args.query ? sanitizeStringInput(args.query) : undefined

  if (args.object_type === 'all') {
    return toToolSuccess(
      await client.search.query({
        ...(query ? { query } : { query: '' }),
        ...(args.limit ? { limit: args.limit } : {}),
        ...(args.cursor ? { cursor: args.cursor } : {}),
      }),
    )
  }

  const resource = getClientResource(client, args.object_type)
  const data = await resource.search({
    ...(query ? { query } : {}),
    ...(args.filter ? { filter: sanitizeRecordPayload(args.filter) } : {}),
    ...(args.sort ? { sort: args.sort } : {}),
    ...(args.limit ? { limit: args.limit } : {}),
    ...(args.cursor ? { cursor: args.cursor } : {}),
    ...(args.include ? { include: args.include } : {}),
  })
  return toToolSuccess(data)
}

export async function handleGetRecord(client: OrbitClient, rawArgs: unknown) {
  const args = GetRecordInput.parse(rawArgs)
  const resource = getClientResource(client, args.object_type)
  const data = await resource.get(args.record_id, args.include)
  return toToolSuccess(sanitizeSecretBearingRecord(args.object_type, data))
}

export async function handleCreateRecord(client: OrbitClient, rawArgs: unknown) {
  const args = CreateRecordInput.parse(rawArgs)
  const resource = getClientResource(client, args.object_type)
  const record = sanitizeRecordPayload(args.record)
  await guardWebhookUrl(client, args.object_type, record)
  const data = await resource.create(record)
  return toToolSuccess(sanitizeSecretBearingRecord(args.object_type, data))
}

export async function handleUpdateRecord(client: OrbitClient, rawArgs: unknown) {
  const args = UpdateRecordInput.parse(rawArgs)
  const resource = getClientResource(client, args.object_type)
  const record = sanitizeRecordPayload(args.record)
  await guardWebhookUrl(client, args.object_type, record)
  const data = await resource.update(args.record_id, record)
  return toToolSuccess(sanitizeSecretBearingRecord(args.object_type, data))
}

export async function handleDeleteRecord(client: OrbitClient, rawArgs: unknown) {
  const args = DeleteRecordInput.parse(rawArgs)
  const resource = getClientResource(client, args.object_type)
  return toToolSuccess(await resource.delete(args.record_id))
}

type GenericResource = {
  create: (input: unknown) => Promise<unknown>
  get: (id: string, include?: string[]) => Promise<unknown>
  update: (id: string, input: unknown) => Promise<unknown>
  delete: (id: string) => Promise<unknown>
  search: (body: Record<string, unknown>) => Promise<unknown>
  batch: (body: Record<string, unknown>) => Promise<unknown>
}

export function getClientResource(client: OrbitClient, objectType: ResourceObjectType): GenericResource {
  const resourceKey = RESOURCE_KEY_MAP[objectType] as ResourceKey | undefined
  if (!resourceKey) {
    throw {
      code: 'UNSUPPORTED_OBJECT_TYPE' as const,
      message: `Unsupported object type: ${objectType}`,
    }
  }

  return client[resourceKey] as unknown as GenericResource
}

async function guardWebhookUrl(client: OrbitClient, objectType: string, record: unknown) {
  if (!isDirectModeClient(client) || objectType !== 'webhooks' || !record || typeof record !== 'object') {
    return
  }

  const url = (record as { url?: unknown }).url
  if (typeof url === 'string') {
    validateWebhookUrlForDirectMode(url)
  }
}
