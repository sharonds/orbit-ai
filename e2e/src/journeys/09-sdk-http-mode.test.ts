import { describe, it, expect } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { OrbitApiError } from '@orbit-ai/sdk'

describe('Journey 9 — SDK in HTTP mode', () => {
  it('authenticates with API key, paginates, and surfaces typed API errors', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    try {
      // Pagination: seed has 200 contacts; pull 2 pages of 50
      const page1 = await stack.sdkHttp.contacts.list({ limit: 50 })
      expect(page1.data.length).toBe(50)
      expect(page1.meta.has_more).toBe(true)
      expect(page1.meta.next_cursor).toBeTruthy()

      const page2 = await stack.sdkHttp.contacts.list({ limit: 50, cursor: page1.meta.next_cursor! })
      expect(page2.data.length).toBeGreaterThan(0)

      // No overlap across pages
      const ids = new Set(page1.data.map((c) => c.id))
      for (const c of page2.data) {
        expect(ids.has(c.id), `Page 2 contact ${c.id} should not appear in page 1`).toBe(false)
      }

      // Typed error on missing record — use a valid-format but non-existent ID
      // Get the prefix from a real contact to ensure correct ID format
      const realId = page1.data[0]!.id
      const fakeId = realId.replace(/[^_]+$/, '0'.repeat(realId.replace(/^[^_]+_/, '').length))
      await expect(stack.sdkHttp.contacts.get(fakeId)).rejects.toSatisfy((err: unknown) => {
        return err instanceof OrbitApiError && err.code === 'RESOURCE_NOT_FOUND'
      })
    } finally {
      await stack.teardown()
    }
  })
})
