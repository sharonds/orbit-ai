import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { runCrudMatrix } from './_crud-matrix.js'

describe('Journey 5 — CRUD deals (5 surfaces)', () => {
  it('create/list/get/update/delete deals across HTTP, direct, API, CLI, MCP', async () => {
    const stack = await buildStack({ tenant: 'acme' })
    try {
      await runCrudMatrix(stack, {
        entity: 'deals',
        create: { name: 'Journey5 Deal', value: 1000 },
        update: { name: 'Journey5 Renamed' },
        expectedIdPrefix: 'deal_',
      })
    } finally {
      await stack.teardown()
    }
  })
})
