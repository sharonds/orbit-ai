import { describe, expect, it } from 'vitest'
import { buildStack, type Stack } from '../harness/build-stack.js'

const API_VERSION = '2026-04-01'

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

async function rawApiList(stack: Stack, entity: string): Promise<Array<{ id: string }>> {
  const response = await rawApi(stack, `${entity}?limit=5`)
  expect(response.status, `${entity} list status`).toBe(200)
  const envelope = (await response.json()) as { data?: Array<{ id: string }> }
  return envelope.data ?? []
}

async function rawApi(
  stack: Stack,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return stack.api.fetch(new Request(`http://test.local/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stack.rawApiKey}`,
      'Orbit-Version': API_VERSION,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  }))
}

async function expectScopeError(response: Response, label: string): Promise<void> {
  expect(response.status, `${label} status`).toBe(403)
  const envelope = (await response.json()) as { error?: { code?: string } }
  expect(envelope.error?.code, `${label} code`).toBe('AUTH_INSUFFICIENT_SCOPE')
}
