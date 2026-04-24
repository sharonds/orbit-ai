import { describe, it, expect } from 'vitest'
import { buildStack } from './build-stack.js'

describe('buildStack', () => {
  it('returns a working stack seeded with the acme tenant', async () => {
    const stack = await buildStack({ tenant: 'acme' })
    try {
      expect(stack.acmeOrgId).toMatch(/^org_/)
      expect(stack.rawApiKey).toMatch(/^sk_test_/)
      const contacts = await stack.sdkHttp.contacts.list({ limit: 5 })
      expect(contacts.data.length).toBeGreaterThan(0)
    } finally {
      await stack.teardown()
    }
  }, 120_000)
})
