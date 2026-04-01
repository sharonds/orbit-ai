import { describe, expect, it } from 'vitest'

import { createInMemoryUserRepository } from './repository.js'
import { createUserService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('user service', () => {
  it('creates, updates, and scopes users by organization', async () => {
    const service = createUserService(createInMemoryUserRepository())
    const created = await service.create(ctx, {
      email: 'owner@orbit.test',
      name: 'Orbit Owner',
      role: 'owner',
    })

    const updated = await service.update(ctx, created.id, {
      role: 'admin',
    })

    expect(updated.role).toBe('admin')
    await expect(
      service.get(
        {
          orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
        },
        created.id,
      ),
    ).resolves.toBeNull()
  })

  it('lists and searches users', async () => {
    const service = createUserService(createInMemoryUserRepository())
    await service.create(ctx, {
      email: 'owner@orbit.test',
      name: 'Orbit Owner',
      role: 'owner',
      externalAuthId: 'auth_owner_secret',
    })
    await service.create(ctx, {
      email: 'agent@orbit.test',
      name: 'Agent User',
      role: 'member',
      externalAuthId: 'auth_agent_secret',
    })

    const page = await service.list(ctx, {
      limit: 1,
      sort: [{ field: 'name', direction: 'asc' }],
    })
    const search = await service.search(ctx, {
      query: 'agent',
      limit: 10,
    })
    const hiddenFieldSearch = await service.search(ctx, {
      query: 'auth_agent_secret',
      limit: 10,
    })

    expect(page.data).toHaveLength(1)
    expect(page.hasMore).toBe(true)
    expect(search.data.map((record) => record.email)).toEqual(['agent@orbit.test'])
    expect(hiddenFieldSearch.data).toEqual([])
  })
})
