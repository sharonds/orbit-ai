import type { ErrorHandler } from 'hono'
import { OrbitError, orbitErrorCodeToStatus } from '@orbit-ai/core'
import type { OrbitErrorCode } from '@orbit-ai/core'
import { ZodError } from 'zod'
import '../context.js'

export const orbitErrorHandler: ErrorHandler = (err, c) => {
  if (err instanceof OrbitError) {
    const status = orbitErrorCodeToStatus(err.code)
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          field: err.field,
          request_id: c.get('requestId'),
          doc_url: `https://orbit-ai.dev/docs/errors#${err.code.toLowerCase()}`,
          hint: err.hint,
          recovery: err.recovery,
          retryable: err.retryable ?? false,
        },
      },
      status as Parameters<typeof c.json>[1],
    )
  }
  // Use a duck-type guard in addition to instanceof to handle the case where
  // multiple Zod instances are loaded (e.g. via workspace hoisting). In Zod v4,
  // `new ZodError()` no longer extends Error, but errors thrown by schema.parse()
  // do — they carry `name === 'ZodError'`, `_zod`, and `issues`.
  const isZodError = (e: unknown): e is ZodError =>
    e instanceof ZodError ||
    (e instanceof Error &&
      e.name === 'ZodError' &&
      Array.isArray((e as { issues?: unknown }).issues))
  if (isZodError(err)) {
    const hint = err.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return c.json(
      {
        error: {
          code: 'VALIDATION_FAILED' as OrbitErrorCode,
          message: 'Request body failed validation',
          request_id: c.get('requestId'),
          doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
          hint,
          retryable: false,
        },
      },
      400,
    )
  }
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_FAILED' as OrbitErrorCode,
          message: 'Request body contains invalid JSON',
          request_id: c.get('requestId'),
          doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
          hint: 'Ensure the request body is valid JSON',
          retryable: false,
        },
      },
      400,
    )
  }
  // Unexpected error — log it before returning an opaque 500.
  // We log to stderr here because the api package has no opinion on which
  // structured logger to use; whatever log drain the host uses will pick up
  // stderr (Vercel, Cloudflare, Fly, Docker, etc.). Structured shape so log
  // processors can parse.
  console.error({
    msg: 'unhandled error in orbitErrorHandler',
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    request_id: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
  })

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        request_id: c.get('requestId'),
        retryable: false,
      },
    },
    500,
  )
}
