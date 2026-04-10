import type { OrbitApiError } from '@orbit-ai/sdk'
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
  | 'RATE_LIMITED'
  | 'CONFLICT'

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
  RATE_LIMITED: 'Retry after backing off — you have exceeded the Orbit API request quota.',
  CONFLICT: 'A conflicting record or operation already exists.',
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
  RATE_LIMITED: 'Wait and retry with exponential backoff. Do not retry immediately.',
  CONFLICT: 'Fetch the existing record and decide whether to update it instead.',
}

function redactSensitiveText(input: string | undefined | null): string {
  let output = String(input ?? '')
  output = output.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
  output = output.replace(/\bsecret[=:]\s*\S+/gi, 'secret=[redacted]')
  output = output.replace(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]{20,}/g, '[redacted]')
  output = output.replace(/\bya29\.[A-Za-z0-9._-]+\b/g, '[redacted]')
  output = output.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, '[redacted]')
  // client_id is included here for internal service clients; standard OAuth client_id
  // values are public, but we keep them out of user-facing error strings.
  output = output.replace(
    /\b(api[_-]?key|refresh_token|client_secret|access_token|client[_-]?id)[=:]\s*[^\s,&"'\]]+/gi,
    '$1=[redacted]',
  )
  // Collapse any double-bracket artifact left when a redacted value ended with `]`
  // e.g. `access_token=[redacted]]remaining` → `access_token=[redacted]remaining`
  output = output.replace(/\[redacted\]\]+/g, '[redacted]')
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

// `recovery` is intentionally absent here — normalizeToolError fills it via
// withDefaults using DEFAULT_RECOVERY['DEPENDENCY_NOT_AVAILABLE'].
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
  if (error instanceof McpToolError) {
    return {
      code: error.code,
      message: redactSensitiveText(error.message),
      hint: redactSensitiveText(error.hint),
      recovery: redactSensitiveText(error.recovery),
    }
  }

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
    const messages = error.issues
      .filter((issue): issue is { message: string } =>
        !!issue && typeof issue === 'object' && typeof (issue as Record<string, unknown>).message === 'string',
      )
      .map((issue) => issue.message)
      .join('; ')
    return withDefaults({
      code: 'VALIDATION_FAILED',
      message: redactSensitiveText(messages || 'Validation failed.'),
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

function isZodError(error: unknown): error is { name: 'ZodError'; issues: unknown[] } {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as Record<string, unknown>).name === 'ZodError' &&
    'issues' in error &&
    Array.isArray((error as Record<string, unknown>).issues)
  )
}

// Compile-time exhaustiveness guard: `{ [K in McpToolErrorCode]: true }` forces
// every union member to appear as a key here. `VALID_MCP_CODES` is built from
// these keys, so `isToolErrorShape` automatically covers the full union.
const _VALID_MCP_CODES_MAP: { [K in McpToolErrorCode]: true } = {
  RESOURCE_NOT_FOUND: true,
  VALIDATION_FAILED: true,
  AUTH_INVALID: true,
  DESTRUCTIVE_CONFIRM_REQUIRED: true,
  UNSUPPORTED_OBJECT_TYPE: true,
  DEPENDENCY_NOT_AVAILABLE: true,
  INTERNAL_ERROR: true,
  SSRF_BLOCKED: true,
  UNKNOWN_TOOL: true,
  RATE_LIMITED: true,
  CONFLICT: true,
}
const VALID_MCP_CODES = new Set<McpToolErrorCode>(
  Object.keys(_VALID_MCP_CODES_MAP) as Array<keyof typeof _VALID_MCP_CODES_MAP>,
)

function isToolErrorShape(error: unknown): error is McpToolErrorShape {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    VALID_MCP_CODES.has((error as Record<string, unknown>).code as McpToolErrorCode) &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

function isOrbitApiError(error: unknown): error is OrbitApiError {
  if (!error || typeof error !== 'object') return false
  const e = error as Record<string, unknown>
  return (
    'error' in e &&
    typeof e.error === 'object' &&
    e.error !== null &&
    'code' in (e.error as Record<string, unknown>) &&
    typeof (e.error as Record<string, unknown>).code === 'string' &&
    'status' in e &&
    typeof e.status === 'number' &&
    'code' in e &&
    typeof e.code === 'string' &&
    'message' in e &&
    typeof e.message === 'string'
  )
}

function mapApiErrorCode(code: string): McpToolErrorCode {
  if (code === 'RESOURCE_NOT_FOUND') return 'RESOURCE_NOT_FOUND'
  if (code === 'VALIDATION_FAILED') return 'VALIDATION_FAILED'
  if (code === 'AUTH_INVALID_API_KEY') return 'AUTH_INVALID'
  if (code === 'RATE_LIMITED') return 'RATE_LIMITED'
  if (code === 'CONFLICT' || code === 'IDEMPOTENCY_CONFLICT') return 'CONFLICT'
  return 'INTERNAL_ERROR'
}
