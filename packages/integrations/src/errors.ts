// Error codes — semantic, not collapsed into INTERNAL_ERROR
export type IntegrationErrorCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_REVOKED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_INPUT'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR'
  | 'DEPENDENCY_NOT_AVAILABLE'

export interface IntegrationError {
  readonly _type: 'IntegrationError'
  readonly code: IntegrationErrorCode
  readonly message: string
  readonly provider?: string
  readonly cause?: unknown
}

// Type guard — duck-type, NOT instanceof
export function isIntegrationError(err: unknown): err is IntegrationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    '_type' in err &&
    (err as Record<string, unknown>)['_type'] === 'IntegrationError'
  )
}

// Factory — creates IntegrationError without using a class
export function createIntegrationError(
  code: IntegrationErrorCode,
  message: string,
  options?: { provider?: string; cause?: unknown },
): IntegrationError {
  return {
    _type: 'IntegrationError',
    code,
    message,
    ...(options?.provider !== undefined ? { provider: options.provider } : {}),
    ...(options?.cause !== undefined ? { cause: options.cause } : {}),
  }
}

// Normalize any thrown value to IntegrationError
export function toIntegrationError(err: unknown, provider?: string): IntegrationError {
  if (isIntegrationError(err)) return err
  const message = err instanceof Error ? err.message : String(err)
  const providerOpt = provider !== undefined ? { provider } : {}
  // Map common HTTP status codes to semantic codes
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('token expired')) {
      return createIntegrationError('AUTH_EXPIRED', message, { ...providerOpt, cause: err })
    }
    if (msg.includes('429') || msg.includes('rate limit')) {
      return createIntegrationError('RATE_LIMITED', message, { ...providerOpt, cause: err })
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return createIntegrationError('NOT_FOUND', message, { ...providerOpt, cause: err })
    }
    if (msg.includes('409') || msg.includes('conflict')) {
      return createIntegrationError('CONFLICT', message, { ...providerOpt, cause: err })
    }
    return createIntegrationError('PROVIDER_ERROR', message, { ...providerOpt, cause: err })
  }
  return createIntegrationError('PROVIDER_ERROR', message, providerOpt)
}

// Convert IntegrationError to the appropriate downstream error type
export function fromIntegrationError(
  err: IntegrationError,
  target: 'mcp' | 'api' | 'cli',
): unknown {
  switch (target) {
    case 'mcp':
      // Returns a shape compatible with McpToolError
      return { type: 'error', error: { code: err.code, message: err.message } }
    case 'api':
      // Returns a shape compatible with OrbitError for API route responses
      return { error: { code: err.code, message: err.message } }
    case 'cli':
      // Human-readable string for CLI output
      return `Error [${err.code}]: ${err.message}`
    default:
      // Exhaustiveness guard — compile error if a new target is added without handling it
      assertNever(target)
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${String(x)}`)
}
