import type { OrbitErrorShape } from '@orbit-ai/core'

export class OrbitApiError extends Error {
  constructor(
    public readonly error: OrbitErrorShape,
    public readonly status: number,
  ) {
    super(error.message)
    this.name = 'OrbitApiError'
  }

  static async fromResponse(response: Response): Promise<OrbitApiError> {
    let errorShape: OrbitErrorShape = {
      code: 'INTERNAL_ERROR',
      message: `HTTP ${response.status}`,
      retryable: response.status >= 500,
    }
    try {
      const body = (await response.json()) as { error?: OrbitErrorShape }
      if (body.error) {
        errorShape = body.error
      }
    } catch {
      // Non-JSON response (gateway errors, proxies, etc.)
    }
    return new OrbitApiError(errorShape, response.status)
  }
}
