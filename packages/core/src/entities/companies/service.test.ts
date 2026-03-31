import { describe, expect, it } from 'vitest'

import { createCompanyService } from './service.js'
import { createInMemoryCompanyRepository } from './repository.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('company service', () => {
  it('creates and retrieves org-scoped companies', async () => {
    const service = createCompanyService(createInMemoryCompanyRepository())

    const created = await service.create(ctx, {
      name: 'Orbit Labs',
      domain: 'orbit.dev',
    })

    await expect(service.get(ctx, created.id)).resolves.toEqual(created)
  })

  it('updates companies and keeps tenant scope enforced', async () => {
    const service = createCompanyService(createInMemoryCompanyRepository())
    const created = await service.create(ctx, {
      name: 'Orbit Labs',
    })

    const updated = await service.update(ctx, created.id, {
      industry: 'Software',
    })

    expect(updated.industry).toBe('Software')
    await expect(
      service.get(
        {
          orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
        },
        created.id,
      ),
    ).resolves.toBeNull()
  })

  it('lists and searches companies with cursor pagination', async () => {
    const service = createCompanyService(createInMemoryCompanyRepository())
    await service.create(ctx, { name: 'Orbit Labs', domain: 'orbit.dev' })
    await service.create(ctx, { name: 'Acme Systems', domain: 'acme.dev' })

    const firstPage = await service.list(ctx, {
      limit: 1,
      sort: [{ field: 'name', direction: 'asc' }],
    })

    expect(firstPage.data).toHaveLength(1)
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.nextCursor).not.toBeNull()

    const search = await service.search(ctx, {
      query: 'orbit',
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.name).toBe('Orbit Labs')
  })
})
