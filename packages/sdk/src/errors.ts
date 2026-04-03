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
    const body = (await response.json()) as { error: OrbitErrorShape }
    return new OrbitApiError(body.error, response.status)
  }
}
