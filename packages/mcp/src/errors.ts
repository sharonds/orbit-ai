import { OrbitApiError } from '@orbit-ai/sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export type McpToolErrorCode =
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'AUTH_INVALID'
  | 'DESTRUCTIVE_CONFIRM_REQUIRED'
  | 'UNSUPPORTED_OBJECT_TYPE'
  | 'DEPENDENCY_NOT_AVAILABLE'
  | 'INTERNAL_ERROR'
  | 'SSRF_BLOCKED'
  | 'UNKNOWN_TOOL'

export interface McpToolErrorShape {
  code: McpToolErrorCode
  message: string
  hint?: string
  recovery?: string
}

export interface JsonTextContent {
  type: 'text'
  text: string
}

const DEFAULT_HINTS: Record<McpToolErrorCode, string> = {
  RESOURCE_NOT_FOUND: 'Verify the referenced Orbit record ID is correct.',
  VALIDATION_FAILED: 'Review the tool input and retry with a valid payload.',
  AUTH_INVALID: 'Provide a valid Orbit bearer token before retrying.',
  DESTRUCTIVE_CONFIRM_REQUIRED: 'Retry with an explicit destructive confirmation.',
  UNSUPPORTED_OBJECT_TYPE: 'Choose an Orbit object type supported by this tool.',
  DEPENDENCY_NOT_AVAILABLE: 'This capability is not yet available in the Orbit SDK/API surface.',
  INTERNAL_ERROR: 'Retry if the issue is transient, otherwise inspect server logs.',
  SSRF_BLOCKED: 'Use a public webhook destination instead of an internal or link-local address.',
  UNKNOWN_TOOL: 'Call one of the registered Orbit MCP tools instead.',
}

const DEFAULT_RECOVERY: Record<McpToolErrorCode, string> = {
  RESOURCE_NOT_FOUND: 'Use search_records to find the correct record ID first.',
  VALIDATION_FAILED: 'Adjust the input shape and call the tool again.',
  AUTH_INVALID: 'Refresh the API key or check the Authorization header format.',
  DESTRUCTIVE_CONFIRM_REQUIRED: 'Reissue the delete request with confirm: true after validating scope.',
  UNSUPPORTED_OBJECT_TYPE: 'Inspect the tool description and retry with a supported object type.',
  DEPENDENCY_NOT_AVAILABLE: 'This capability is not yet available. Check the Orbit changelog for availability.',
  INTERNAL_ERROR: 'Retry later. If the problem persists, inspect the underlying Orbit service logs.',
  SSRF_BLOCKED: 'Change the webhook URL to a publicly routable destination and retry.',
  UNKNOWN_TOOL: 'List tools again and select a valid Orbit MCP tool name.',
}

function redactSensitiveText(input: string | undefined | null): string {
  let output = String(input ?? '')
  output = output.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
  output = output.replace(/\bsecret\b/gi, '[redacted]')
  output = output.replace(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]{20,}/g, '[redacted]')
  output = output.replace(/\bya29\.[A-Za-z0-9._-]+\b/g, '[redacted]')
  output = output.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, '[redacted]')
  return output.slice(0, 500)
}

export class McpToolError extends Error {
  constructor(
    readonly code: McpToolErrorCode,
    message: string,
    readonly hint: string = DEFAULT_HINTS[code],
    readonly recovery: string = DEFAULT_RECOVERY[code],
  ) {
    super(message)
    this.name = 'McpToolError'
  }
}

export class McpNotImplementedError extends Error {
  readonly code = 'DEPENDENCY_NOT_AVAILABLE' as const

  constructor(message = 'This capability is not yet available.', readonly hint?: string) {
    super(message)
    this.name = 'McpNotImplementedError'
  }
}

export function toToolError(error: unknown): CallToolResult {
  const normalized = normalizeToolError(error)
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ok: false,
            error: normalized,
          },
          null,
          2,
        ),
      },
    ],
  }
}

export function toToolSuccess(data: unknown, meta?: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ok: true,
            data,
            ...(meta ? { meta } : {}),
          },
          null,
          2,
        ),
      },
    ],
  }
}

export function normalizeToolError(error: unknown): Required<McpToolErrorShape> {
  if (error instanceof McpNotImplementedError) {
    return withDefaults(
      error.hint
        ? {
            code: 'DEPENDENCY_NOT_AVAILABLE',
            message: error.message,
            hint: error.hint,
          }
        : {
            code: 'DEPENDENCY_NOT_AVAILABLE',
            message: error.message,
          },
    )
  }

  if (isZodError(error)) {
    return withDefaults({
      code: 'VALIDATION_FAILED',
      message: redactSensitiveText((error as { issues: Array<{ message: string }> }).issues.map((issue) => issue.message).join('; ')),
    })
  }

  if (isOrbitApiError(error)) {
    return withDefaults(
      {
        code: mapApiErrorCode(error.code),
        message: redactSensitiveText(error.message),
        ...(error.error.hint ? { hint: redactSensitiveText(error.error.hint) } : {}),
        ...(error.error.recovery ? { recovery: redactSensitiveText(error.error.recovery) } : {}),
      },
    )
  }

  if (isToolErrorShape(error)) {
    return withDefaults(error)
  }

  if (error instanceof Error) {
    return withDefaults({
      code: 'INTERNAL_ERROR',
      message: redactSensitiveText(error.message),
    })
  }

  return withDefaults({
    code: 'INTERNAL_ERROR',
    message: 'An unknown MCP error occurred.',
  })
}

function withDefaults(error: McpToolErrorShape): Required<McpToolErrorShape> {
  return {
    code: error.code,
    message: redactSensitiveText(error.message),
    hint: redactSensitiveText(error.hint ?? DEFAULT_HINTS[error.code]),
    recovery: redactSensitiveText(error.recovery ?? DEFAULT_RECOVERY[error.code]),
  }
}

function isToolErrorShape(error: unknown): error is McpToolErrorShape {
  return !!error && typeof error === 'object' && 'code' in error && 'message' in error
}

function isOrbitApiError(error: unknown): error is OrbitApiError {
  return (
    error instanceof OrbitApiError ||
    (!!error &&
      typeof error === 'object' &&
      'error' in error &&
      typeof (error as Record<string, unknown>).error === 'object' &&
      (error as Record<string, unknown>).error !== null &&
      'status' in error &&
      typeof (error as Record<string, unknown>).status === 'number' &&
      'code' in error &&
      'message' in error)
  )
}

function isZodError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as Record<string, unknown>).name === 'ZodError' &&
    'issues' in error &&
    Array.isArray((error as Record<string, unknown>).issues)
  )
}

function mapApiErrorCode(code: string): McpToolErrorCode {
  if (code === 'RESOURCE_NOT_FOUND') return 'RESOURCE_NOT_FOUND'
  if (code === 'VALIDATION_FAILED') return 'VALIDATION_FAILED'
  if (code === 'AUTH_INVALID_API_KEY') return 'AUTH_INVALID'
  return 'INTERNAL_ERROR'
}
