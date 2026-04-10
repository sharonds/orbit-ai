import { z } from 'zod'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { sanitizeStringInput } from '../output/truncation.js'

export const BASE_OBJECT_TYPES = [
  'contacts',
  'companies',
  'deals',
  'pipelines',
  'stages',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  'sequence_events',
  'tags',
  'webhooks',
  'users',
  'imports',
] as const

export const ObjectTypeSchema = z.enum(BASE_OBJECT_TYPES)
export const SearchObjectTypeSchema = z.union([ObjectTypeSchema, z.literal('all')])
export const CursorSchema = z.string().nullable().optional()
export const LimitSchema = z.number().int().min(1).max(100).optional()
export const IncludeSchema = z.array(z.string()).optional()
export const SortSchema = z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) })).optional()

export interface OrbitToolDefinition {
  name: string
  title: string
  description: string
  annotations: {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
  }
  inputSchema: z.ZodTypeAny
}

export function defineTool(definition: OrbitToolDefinition): Tool & { inputZodSchema: z.ZodTypeAny } {
  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: z.toJSONSchema(definition.inputSchema) as Tool['inputSchema'],
    annotations: definition.annotations,
    inputZodSchema: definition.inputSchema,
  }
}

export function sanitizeRecordPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeStringInput(value)
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeRecordPayload)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeRecordPayload(entry)]),
    )
  }

  return value
}
