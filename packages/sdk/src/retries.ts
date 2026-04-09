import { OrbitApiError } from './errors.js'

export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number },
): Promise<T> {
  let attempt = 0
  let delayMs = 250
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      const shouldRetry =
        error instanceof OrbitApiError &&
        error.error.retryable === true &&
        attempt < options.maxRetries
      if (!shouldRetry) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempt += 1
      delayMs *= 2
    }
  }
}
