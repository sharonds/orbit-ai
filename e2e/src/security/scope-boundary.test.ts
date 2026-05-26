import { describe, expect, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError, rawApi } from './helpers.js'

describe('Security — API scope boundary', () => {
  it('allows contact reads but blocks contact writes and unrelated entity access for a read-only key', async () => {
    const stack = await buildStack({
      tenant: 'acme',
      adapter: 'sqlite',
      rawApiScopes: ['contacts:read'],
    })

    try {
      const contacts = await rawApiList(stack, 'contacts')
      const contactId = contacts[0]?.id
      expect(contactId, 'seeded contact id').toMatch(/^contact_/)

      const contactGet = await rawApi(stack, `contacts/${contactId}`)
      expect(contactGet.status, 'contacts:read key can get contacts').toBe(200)

      const contactCreate = await rawApi(stack, 'contacts', {
        method: 'POST',
        body: JSON.stringify({ name: 'Scope Boundary Should Not Create' }),
      })
      await expectScopeError(contactCreate, 'contacts:create rejected')

      const contactUpdate = await rawApi(stack, `contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Scope Boundary Should Not Update' }),
      })
      await expectScopeError(contactUpdate, 'contacts:update rejected')

      const contactDelete = await rawApi(stack, `contacts/${contactId}`, {
        method: 'DELETE',
      })
      await expectScopeError(contactDelete, 'contacts:delete rejected')

      const dealsList = await rawApi(stack, 'deals')
      await expectScopeError(dealsList, 'deals:list rejected')

      const taskCreate = await rawApi(stack, 'tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Scope Boundary Should Not Create',
          contact_id: contactId,
        }),
      })
      await expectScopeError(taskCreate, 'tasks:create rejected')
    } finally {
      await stack.teardown()
    }
  })
})

async function rawApiList(
  stack: Awaited<ReturnType<typeof buildStack>>,
  entity: string,
): Promise<Array<{ id: string }>> {
  const response = await rawApi(stack, `${entity}?limit=5`)
  expect(response.status, `${entity} list status`).toBe(200)
  const envelope = (await response.json()) as { data?: Array<{ id: string }> }
  return envelope.data ?? []
}

async function expectScopeError(response: Response, label: string): Promise<void> {
  await expectApiError(response, {
    status: 403,
    code: 'AUTH_INSUFFICIENT_SCOPE',
    label,
  })
}
