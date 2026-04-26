import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool } from './schemas.js'
import { McpNotImplementedError, toToolSuccess } from '../errors.js'
import { sanitizeObjectDeep } from '../output/sensitive.js'

const GetSchemaInput = z.object({
  object_type: z.string().optional(),
})

const CustomFieldInput = z.object({
  object_type: z.string(),
  field_name: z.string().optional(),
  field: z.record(z.string(), z.unknown()),
})

const SAFE_UPDATE_FIELD_KEYS = new Set(['label', 'description'])

const UNSUPPORTED_DESTRUCTIVE_SCHEMA_MIGRATION = new McpNotImplementedError(
  'Destructive schema migration operations are intentionally unavailable through MCP in the alpha.',
  'Use the Orbit API, SDK, or CLI for custom-field rename, type-change, delete, promote, and migration preview/apply/rollback operations.',
)

export const getSchemaTool = defineTool({
  name: 'get_schema',
  title: 'Get Orbit schema',
  description: 'Use this when you need Orbit object metadata or custom field definitions. Do not use it to fetch records.',
  inputSchema: GetSchemaInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export const createCustomFieldTool = defineTool({
  name: 'create_custom_field',
  title: 'Create an Orbit custom field',
  description: 'Use this to add a new custom field to an Orbit object. Do not use it to update an existing field.',
  inputSchema: CustomFieldInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const updateCustomFieldTool = defineTool({
  name: 'update_custom_field',
  title: 'Update an Orbit custom field',
  description: 'Use this when a custom field already exists and needs metadata changes. Do not use it to create a new field.',
  inputSchema: CustomFieldInput.extend({ field_name: z.string() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export async function handleGetSchema(client: OrbitClient, rawArgs: unknown) {
  const args = GetSchemaInput.parse(rawArgs)
  if (args.object_type) {
    return toToolSuccess(sanitizeObjectDeep(await client.schema.describeObject(args.object_type)))
  }
  return toToolSuccess(sanitizeObjectDeep(await client.schema.listObjects()))
}

export async function handleCreateCustomField(client: OrbitClient, rawArgs: unknown) {
  const args = CustomFieldInput.parse(rawArgs)
  return toToolSuccess(sanitizeObjectDeep(await client.schema.addField(args.object_type, args.field)))
}

export async function handleUpdateCustomField(client: OrbitClient, rawArgs: unknown) {
  const args = CustomFieldInput.extend({ field_name: z.string() }).parse(rawArgs)
  if (!isSafeCustomFieldMetadataPatch(args.field)) {
    throw UNSUPPORTED_DESTRUCTIVE_SCHEMA_MIGRATION
  }

  return toToolSuccess(
    sanitizeObjectDeep(await client.schema.updateField(args.object_type, args.field_name, args.field)),
  )
}

function isSafeCustomFieldMetadataPatch(field: Record<string, unknown>): boolean {
  return Object.keys(field).every((key) => SAFE_UPDATE_FIELD_KEYS.has(key))
}
