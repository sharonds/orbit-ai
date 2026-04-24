import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { runCrudMatrix } from './_crud-matrix.js'

describe('Journey 3 — CRUD contacts (5 surfaces)', () => {
  it('create/list/get/update/delete contacts across HTTP, direct, API, CLI, MCP', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    try {
      await runCrudMatrix(stack, {
        entity: 'contacts',
        create: { name: 'Journey3 Person', email: 'j3@journey3.local' },
        update: { name: 'Journey3 Renamed' },
        expectedIdPrefix: 'contact_',
      })
    } finally {
      await stack.teardown()
    }
  })
})
