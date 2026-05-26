import { describe, expect, it } from 'vitest'
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

      const before = await stack.sdkDirect.contacts.list({ limit: 100 })
      await expectApiError(await stack.api.fetch(new Request('http://test.local/v1/contacts', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk_test_invalid',
          'Orbit-Version': '2026-04-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Unauthorized Write Sentinel',
          email: 'unauthorized-write@example.test',
        }),
      })), {
        status: 401,
        code: 'AUTH_INVALID_API_KEY',
        label: 'invalid auth write',
      })
      const after = await stack.sdkDirect.contacts.list({ limit: 100 })
      expect(after.data.length, 'invalid auth write must not create a contact').toBe(before.data.length)
      expect(after.data.some((contact) => contact.email === 'unauthorized-write@example.test')).toBe(false)
    } finally {
      await stack.teardown()
    }
  })
})
