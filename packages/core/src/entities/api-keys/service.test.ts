import { describe, expect, it } from 'vitest'

import { createInMemoryApiKeyRepository } from './repository.js'
import { createApiKeyAdminService, createApiKeyService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('api key services', () => {
  it('creates, updates, and scopes tenant API keys', async () => {
    const repository = createInMemoryApiKeyRepository()
    const service = createApiKeyService(repository)

    const created = await service.create(ctx, {
      name: 'Server',
      keyHash: 'hashed-secret',
      keyPrefix: 'orbt_live',
      scopes: ['contacts:read'],
    })

    const updated = await service.update(ctx, created.id, {
      revokedAt: new Date('2026-03-31T13:00:00.000Z'),
    })

    expect(updated.revokedAt?.toISOString()).toBe('2026-03-31T13:00:00.000Z')
    await expect(
      service.get(
        {
          orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
        },
        created.id,
      ),
    ).resolves.toBeNull()
  })

  it('lists, searches, and exposes admin reads separately', async () => {
    const repository = createInMemoryApiKeyRepository()
    const service = createApiKeyService(repository)
    const admin = createApiKeyAdminService(repository)

    const created = await service.create(ctx, {
      name: 'CLI',
      keyHash: 'hashed-cli',
      keyPrefix: 'orbt_cli',
      scopes: ['contacts:write'],
    })

    const list = await service.list(ctx, { limit: 10 })
    const search = await service.search(ctx, { query: 'cli', limit: 10 })
    const adminRecord = await admin.get(ctx, created.id)

    expect(list.data).toHaveLength(1)
    expect(search.data[0]?.id).toBe(created.id)
    expect(adminRecord?.keyPrefix).toBe('orbt_cli')
  })
})
