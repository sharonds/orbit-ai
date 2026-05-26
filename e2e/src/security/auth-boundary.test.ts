import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError } from './helpers.js'

describe('Security — auth boundary', () => {
  it('rejects missing and invalid API keys without writing data', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      await expectApiError(await stack.api.fetch(new Request('http://test.local/v1/contacts')), {
        status: 401,
        code: 'AUTH_INVALID_API_KEY',
        label: 'missing auth',
      })
      await expectApiError(await stack.api.fetch(new Request('http://test.local/v1/contacts', {
        headers: {
          Authorization: 'Bearer sk_test_invalid',
          'Orbit-Version': '2026-04-01',
        },
      })), {
        status: 401,
        code: 'AUTH_INVALID_API_KEY',
        label: 'invalid auth',
      })
    } finally {
      await stack.teardown()
    }
  })
})
