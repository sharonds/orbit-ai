import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { runCrudMatrix } from './_crud-matrix.js'

describe('Journey 4 — CRUD companies (5 surfaces)', () => {
  it('create/list/get/update/delete companies across HTTP, direct, API, CLI, MCP', async () => {
    const stack = await buildStack({ tenant: 'acme' })
    try {
      await runCrudMatrix(stack, {
        entity: 'companies',
        create: { name: 'Journey4 Co', domain: 'journey4.test' },
        update: { name: 'Journey4 Renamed' },
        expectedIdPrefix: 'company_',
      })
    } finally {
      await stack.teardown()
    }
  })
})
