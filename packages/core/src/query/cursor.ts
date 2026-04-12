import { z } from 'zod'

import type { SortSpec } from '../types/api.js'
import { createOrbitError } from '../types/errors.js'

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  orgId: z.string().min(1).optional(),
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

// Cross-runtime base64url codec. Node.js exposes `Buffer`, while browser /
// edge / Deno / Bun runtimes only guarantee `btoa`/`atob`. The SDK ships
// `cursor.ts` to consumers via `@orbit-ai/core`, so we cannot assume Buffer
// exists. The detection is intentionally lazy (per-call) so tests and
// runtime polyfills that mutate `globalThis.Buffer` are honored.
function utf8ToBase64Url(input: string): string {
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(input, 'utf8').toString('base64url')
  }
  // btoa accepts Latin-1 only — encode UTF-8 first via TextEncoder, then
  // map each byte to a Latin-1 char so btoa produces valid base64.
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlToUtf8(input: string): string {
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(input, 'base64url').toString('utf8')
  }
  // Restore base64 padding before atob.
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (padded.length % 4)) % 4
  const binary = globalThis.atob(padded + '='.repeat(padLength))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export function encodeCursor(payload: CursorPayload): string {
  return utf8ToBase64Url(JSON.stringify(payload))
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = base64UrlToUtf8(cursor)
    return cursorPayloadSchema.parse(JSON.parse(decoded))
  } catch (err) {
    const isOrbitError = err instanceof Error && (err as { code?: string }).code !== undefined
    if (isOrbitError) {
      throw err
    }
    throw createOrbitError({
      code: 'INVALID_CURSOR',
      message: 'Invalid cursor',
    })
  }
}

export function decodeCursorWithOrgCheck(cursor: string, expectedOrgId: string): CursorPayload {
  const payload = decodeCursor(cursor)
  if (payload.orgId !== undefined && payload.orgId !== expectedOrgId) {
    throw createOrbitError({
      code: 'INVALID_CURSOR',
      message: 'Invalid cursor',
    })
  }
  return payload
}

export function createCursorPayload(input: {
  orgId?: string
  id: string
  sort: SortSpec[]
  values: Record<string, string | number | boolean | null>
}): CursorPayload {
  return {
    version: 1,
    ...(input.orgId !== undefined ? { orgId: input.orgId } : {}),
    id: input.id,
    sort: input.sort,
    values: input.values,
  }
}
