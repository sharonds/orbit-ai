import { describe, it, expect } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { OrbitApiError } from '@orbit-ai/sdk'

describe('Journey 10 — SDK in direct-core mode', () => {
  it('reads/writes in-process without HTTP, and surfaces typed errors', async () => {
    const stack = await buildStack({ tenant: 'acme' })
    try {
      // Create a contact via direct transport
      const contact = await stack.sdkDirect.contacts.create({
        name: 'Direct Journey',
        email: 'direct@journey10.local',
      })
      expect(contact.id).toMatch(/^contact_/)

      // Read back
      const fetched = await stack.sdkDirect.contacts.get(contact.id)
      expect(fetched.name).toBe('Direct Journey')

      // Typed error for missing record
      const realId = contact.id
      const fakeId = realId.replace(/[^_]+$/, '0'.repeat(realId.replace(/^[^_]+_/, '').length))
      await expect(stack.sdkDirect.contacts.get(fakeId)).rejects.toSatisfy((err: unknown) => {
        return err instanceof OrbitApiError && err.code === 'RESOURCE_NOT_FOUND'
      })
    } finally {
      await stack.teardown()
    }
  })
})
