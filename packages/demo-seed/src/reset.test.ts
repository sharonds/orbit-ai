import { describe, it, expect, vi } from 'vitest'
import {
  createCoreServices,
  createSqliteEntityTagRepository,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  generateId,
} from '@orbit-ai/core'
import { seed } from './seed.js'
import { resetSeed } from './reset.js'
import { TENANT_PROFILES } from './profiles.js'

describe('resetSeed', () => {
  it('removes ALL seeded entity types — not just contacts/companies', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const result = await seed(adapter, { profile: TENANT_PROFILES.beta })
    await resetSeed(adapter, result.organization.id)
    const services = createCoreServices(adapter)
    const ctx = { orgId: result.organization.id }
    // Assert zero on every entity seed() writes — not a subset. Run serially:
    // SQLite transactions in the adapter are not concurrency-safe under Promise.all.
    const contacts = await services.contacts.list(ctx, { limit: 100 })
    const companies = await services.companies.list(ctx, { limit: 100 })
    const deals = await services.deals.list(ctx, { limit: 100 })
    const activities = await services.activities.list(ctx, { limit: 100 })
    const notes = await services.notes.list(ctx, { limit: 100 })
    const tags = await services.tags.list(ctx, { limit: 100 })
    const pipelines = await services.pipelines.list(ctx, { limit: 100 })
    const stages = await services.stages.list(ctx, { limit: 100 })
    const users = await services.users.list(ctx, { limit: 100 })
    expect(contacts.data.length).toBe(0)
    expect(companies.data.length).toBe(0)
    expect(deals.data.length).toBe(0)
    expect(activities.data.length).toBe(0)
    expect(notes.data.length).toBe(0)
    expect(tags.data.length).toBe(0)
    expect(pipelines.data.length).toBe(0)
    expect(stages.data.length).toBe(0)
    expect(users.data.length).toBe(0)
  }, 90_000)

  it('no-ops on a non-matching organization id (no throw)', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    // This test's value is the assertion in resetSeed() itself — if the service
    // registry ever drops an entity name, reset must fail loudly rather than
    // silently leaving data behind. If all services exist normally AND the org
    // id matches nothing, reset is simply a no-op (list returns empty).
    await seed(adapter, { profile: TENANT_PROFILES.beta })
    // Valid-shape ULID that does not correspond to any seeded org.
    await expect(
      resetSeed(adapter, 'org_01HZZZZZZZZZZZZZZZZZZZZZZZ'),
    ).resolves.not.toThrow()
  }, 60_000)

  it('deletes entity_tags before tags so consumer-created tag associations do not block reset', async () => {
    // Simulate a consumer who, after seeding, associated one of the seed tags
    // with one of the seed contacts via entity_tags. A naïve resetSeed that
    // deletes tags before entity_tags would hit a FK violation on Postgres
    // and silently leave orphaned rows on SQLite. Verify reset completes and
    // both tables are empty afterwards.
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const seeded = await seed(adapter, { profile: TENANT_PROFILES.beta })
    const services = createCoreServices(adapter)
    const ctx = { orgId: seeded.organization.id }
    const tag = (await services.tags.list(ctx, { limit: 1 })).data[0]
    const contact = (await services.contacts.list(ctx, { limit: 1 })).data[0]
    expect(tag).toBeDefined()
    expect(contact).toBeDefined()

    const entityTagRepo = createSqliteEntityTagRepository(adapter)
    const now = new Date()
    await entityTagRepo.create(ctx, {
      id: generateId('entityTag'),
      organizationId: seeded.organization.id,
      tagId: tag!.id,
      entityType: 'contacts',
      entityId: contact!.id,
      createdAt: now,
      updatedAt: now,
    })
    const preReset = await entityTagRepo.list(ctx, { limit: 10 })
    expect(preReset.data.length).toBe(1)

    await resetSeed(adapter, seeded.organization.id)

    const postEntityTags = await entityTagRepo.list(ctx, { limit: 10 })
    const postTags = await services.tags.list(ctx, { limit: 10 })
    expect(postEntityTags.data.length).toBe(0)
    expect(postTags.data.length).toBe(0)
  }, 90_000)

  it('throws loudly when a service in the delete order is missing list/delete', async () => {
    // Simulate a future refactor where an entity service is dropped from
    // CoreServices. The loud-throw path in resetSeed is the safety net for
    // that scenario; verify it actually fires rather than silently skipping.
    const coreModule = await import('@orbit-ai/core')
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const real = coreModule.createCoreServices(adapter)
    // Build a partial stand-in with `tasks` stripped to force the throw.
    const broken = { ...real } as Record<string, unknown>
    delete broken.tasks
    const spy = vi
      .spyOn(coreModule, 'createCoreServices')
      .mockReturnValue(broken as unknown as ReturnType<typeof coreModule.createCoreServices>)
    try {
      // Re-import reset.js so the mocked createCoreServices is picked up at call time.
      const { resetSeed: resetSeedIsolated } = await import('./reset.js')
      await expect(
        resetSeedIsolated(adapter, 'org_01HZZZZZZZZZZZZZZZZZZZZZZZ'),
      ).rejects.toThrow(/missing list\/delete/)
    } finally {
      spy.mockRestore()
    }
  }, 30_000)
})
