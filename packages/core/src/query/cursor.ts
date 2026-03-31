import { z } from 'zod'

import type { SortSpec } from '../types/api.js'

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  sort: z.array(
    z.object({
      field: z.string().min(1),
      direction: z.enum(['asc', 'desc']),
    }),
  ),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
})

export type CursorPayload = z.infer<typeof cursorPayloadSchema>

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    return cursorPayloadSchema.parse(JSON.parse(decoded))
  } catch {
    throw new Error('Invalid cursor')
  }
}

export function createCursorPayload(input: {
  id: string
  sort: SortSpec[]
  values: Record<string, string | number | boolean | null>
}): CursorPayload {
  return {
    version: 1,
    id: input.id,
    sort: input.sort,
    values: input.values,
  }
}
