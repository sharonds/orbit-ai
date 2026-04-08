import type { Context } from 'hono'
import { OrbitError } from '@orbit-ai/core'

export interface PaginationParams {
  limit: number | undefined
  cursor: string | undefined
}

/**
 * Parse and validate pagination parameters from a Hono request context.
 * Replaces inline `Number(c.req.query('limit'))` patterns across all routes.
 *
 * @throws OrbitError with VALIDATION_FAILED if limit is not an integer between 1 and 100.
 */
export function paginationParams(c: Context): PaginationParams {
  const raw = c.req.query('limit')
  if (raw !== undefined) {
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new OrbitError({
        code: 'VALIDATION_FAILED',
        message: 'limit must be an integer between 1 and 100',
      })
    }
    return { limit: parsed, cursor: c.req.query('cursor') ?? undefined }
  }
  return { limit: undefined, cursor: c.req.query('cursor') ?? undefined }
}
