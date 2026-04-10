export interface RetryOptions {
  maxAttempts?: number // default: 3
  baseDelayMs?: number // default: 500
  maxDelayMs?: number // default: 10_000
  jitter?: boolean // default: true
}

/**
 * Run fn with bounded exponential backoff + jitter.
 * Only retries on retryable errors (HTTP 429/5xx, network errors).
 */
export async function withBoundedRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 500
  const maxDelayMs = options.maxDelayMs ?? 10_000
  const jitter = options.jitter ?? true

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryableError(err)) throw err
      if (attempt === maxAttempts) break

      // Exponential backoff: base * 2^(attempt-1)
      const backoff = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      const delay = jitter ? backoff * (0.5 + Math.random() * 0.5) : backoff
      await sleep(delay)
    }
  }
  throw lastError
}

/**
 * Returns true for errors that warrant a retry attempt.
 * HTTP: 429, 500, 502, 503
 * Network: ECONNREFUSED, ETIMEDOUT, ECONNRESET, ENOTFOUND
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message
    // Network-level errors (common during OAuth token refresh)
    if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND/.test(msg)) return true
    // HTTP status codes in error messages
    if (/\b(429|500|502|503)\b/.test(msg)) return true
    // Status property on fetch/axios errors
    const errObj = err as unknown as Record<string, unknown>
    const status = errObj['status'] ?? errObj['statusCode']
    if (typeof status === 'number' && [429, 500, 502, 503].includes(status)) return true
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
