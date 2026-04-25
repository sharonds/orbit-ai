import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { runCrudMatrix } from './_crud-matrix.js'

describe('Journey 5 — CRUD deals (5 surfaces)', () => {
  it('create/list/get/update/delete deals across HTTP, direct, API, CLI, MCP', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    try {
      await runCrudMatrix(stack, {
        entity: 'deals',
        create: { name: 'Journey5 Deal', value: 1000 },
        update: { name: 'Updated Deal' },
        updateField: 'name',
        updateValue: 'Updated Deal',
        assertField: 'name',
        expectedIdPrefix: 'deal_',
      })
    } finally {
      await stack.teardown()
    }
  })
})
