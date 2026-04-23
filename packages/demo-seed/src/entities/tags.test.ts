import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedTags } from './tags.js'
import { TENANT_PROFILES } from '../profiles.js'

describe('seedTags', () => {
  it('creates 5 tags scoped to the org', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const tags = await seedTags(services, ctx)
    expect(tags.length).toBe(5)
    const names = tags.map((t) => t.name).sort()
    expect(names).toEqual(['champion', 'enterprise', 'eu', 'hot-lead', 'partner'])
    for (const t of tags) {
      expect(t.id).toMatch(/^tag_/)
      expect(t.organizationId).toBe(org.id)
    }
  })

  it('is append-idempotent even when the org has more tags than the pagination cap', async () => {
    // If seedTags relied on a list() without a name filter, it would miss
    // pre-existing seed tags buried past the 100-row pagination cap and then
    // trip the unique-name constraint on create. This test verifies the
    // per-name filtered lookup works at scale.
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    // Create 110 consumer tags — above the 100-row page size — so that any
    // un-filtered list() in seedTags would miss the pre-created 'champion'.
    for (let i = 0; i < 110; i += 1) {
      await services.tags.create(ctx, { name: `consumer-tag-${i}` })
    }
    // Pre-create a tag whose name collides with TAG_NAMES so the dedup path
    // in seedTags must fire — not the plain create path.
    await services.tags.create(ctx, { name: 'champion' })

    // First seed — should append the remaining 4 seed names and re-use the
    // pre-existing 'champion'.
    const first = await seedTags(services, ctx)
    expect(first.length).toBe(5)
    // Second seed — must not throw a unique-constraint error.
    const second = await seedTags(services, ctx)
    expect(second.length).toBe(5)

    // Exactly 110 consumer tags + 5 seed tags, and 'champion' exists once.
    // Paginate in pages of 100 (MAX_LIST_LIMIT) so we see every row.
    const all: Array<{ name: string }> = []
    let cursor: string | undefined
    for (let i = 0; i < 10; i += 1) {
      const page = await services.tags.list(ctx, {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      })
      all.push(...page.data)
      if (!page.nextCursor || page.data.length === 0) break
      cursor = page.nextCursor
    }
    expect(all.length).toBe(115)
    const championMatches = all.filter((t) => t.name === 'champion')
    expect(championMatches.length).toBe(1)
  }, 60_000)
})
