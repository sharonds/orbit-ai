import { describe, expect, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError, rawApi } from './helpers.js'

describe('Security — rate limit', () => {
  it('returns RATE_LIMITED after the default per-key request budget is exhausted', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      let limited: Response | undefined
      for (let index = 0; index < 101; index += 1) {
        const response = await rawApi(stack, 'contacts?limit=1')
        if (response.status === 429) {
          limited = response
          break
        }
        expect(response.status, `request ${index + 1} status`).toBe(200)
      }

      expect(limited, 'rate-limited response').toBeDefined()
      await expectApiError(limited!, {
        status: 429,
        code: 'RATE_LIMITED',
        label: 'default rate limit',
      })
    } finally {
      await stack.teardown()
    }
  })
})
