import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed } from './seed.js'
import { TENANT_PROFILES } from './profiles.js'

async function freshAdapter() {
  const database = createSqliteOrbitDatabase()
  const adapter = createSqliteStorageAdapter({ database })
  await adapter.migrate()
  return adapter
}

// MAX_LIST_LIMIT is 100 in core; paginate to count all tenant records.
async function listAll<T extends { id: string }>(
  svc: { list: (ctx: { orgId: string }, q: { limit: number; cursor?: string }) => Promise<{ data: T[]; nextCursor?: string | null }> },
  orgId: string,
): Promise<T[]> {
  const out: T[] = []
  let cursor: string | undefined
  // Safety bound — loop terminates on empty page or missing cursor.
  for (let i = 0; i < 100; i += 1) {
    const page = await svc.list({ orgId }, cursor ? { limit: 100, cursor } : { limit: 100 })
    out.push(...page.data)
    if (!page.nextCursor || page.data.length === 0) return out
    cursor = page.nextCursor
  }
  return out
}

describe('seed()', () => {
  it('seeds a full acme profile and reports accurate counts', async () => {
    const adapter = await freshAdapter()
    const result = await seed(adapter, { profile: TENANT_PROFILES.acme })
    expect(result.organization.slug).toBe('acme-events')
    expect(result.counts).toEqual({
      contacts: 200,
      companies: 40,
      deals: 15,
      activities: 300,
      notes: 50,
    })
  }, 90_000)

  it('determinism: two independent seed runs produce identical digest over a broad projection', async () => {
    async function digestOf(
      adapter: Awaited<ReturnType<typeof freshAdapter>>,
      orgId: string,
    ): Promise<string> {
      const services = createCoreServices(adapter)
      const ctx = { orgId }
      const companies = await services.companies.list(ctx, {
        limit: 100,
        sort: [{ field: 'name', direction: 'asc' }],
      })
      const contacts = await services.contacts.list(ctx, {
        limit: 20,
        sort: [{ field: 'email', direction: 'asc' }],
      })
      const deals = await services.deals.list(ctx, {
        limit: 20,
        sort: [{ field: 'title', direction: 'asc' }],
      })
      const activities = await services.activities.list(ctx, {
        limit: 30,
        sort: [{ field: 'occurred_at', direction: 'asc' }],
      })
      const notes = await services.notes.list(ctx, {
        limit: 20,
        sort: [{ field: 'created_at', direction: 'asc' }],
      })
      // Project only stable fields — not IDs or FKs, which regenerate per run.
      // Client-side sort on the projected row breaks ULID-tiebreaker order
      // for records sharing a created_at millisecond (notes/activities here).
      const sortedRows = <T>(rows: T[]): T[] =>
        [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      const projection = JSON.stringify({
        companies: sortedRows(companies.data.map((c) => [c.name, c.domain, c.industry])),
        contacts: sortedRows(contacts.data.map((c) => [c.email, c.name, c.title])),
        deals: sortedRows(deals.data.map((d) => [d.title, d.currency])),
        activities: sortedRows(activities.data.map((a) => [a.type, a.subject])),
        notes: sortedRows(notes.data.map((n) => n.content)),
      })
      return createHash('sha256').update(projection).digest('hex')
    }
    const a = await freshAdapter()
    const b = await freshAdapter()
    const profile = TENANT_PROFILES.beta
    // Pin `now` so activity timestamps (which subtract from now) are identical.
    const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)
    const ra = await seed(a, { profile, now: fixedNow })
    const rb = await seed(b, { profile, now: fixedNow })
    expect(await digestOf(a, ra.organization.id)).toEqual(
      await digestOf(b, rb.organization.id),
    )
  }, 90_000)

  it('multi-tenant isolation: acme + beta seeded into the same db do not cross-leak', async () => {
    const adapter = await freshAdapter()
    const acme = await seed(adapter, { profile: TENANT_PROFILES.acme })
    const beta = await seed(adapter, { profile: TENANT_PROFILES.beta })
    const services = createCoreServices(adapter)
    const acmeContacts = await listAll(services.contacts, acme.organization.id)
    const betaContacts = await listAll(services.contacts, beta.organization.id)
    expect(acmeContacts.length).toBe(200)
    expect(betaContacts.length).toBe(50)
    const acmeIds = new Set(acmeContacts.map((r) => r.id))
    for (const bc of betaContacts) expect(acmeIds.has(bc.id)).toBe(false)

    // T2: also verify deals / activities / notes do not cross-leak.
    const acmeDeals = await listAll(services.deals, acme.organization.id)
    const betaDeals = await listAll(services.deals, beta.organization.id)
    const acmeDealIds = new Set(acmeDeals.map((r) => r.id))
    for (const bd of betaDeals) expect(acmeDealIds.has(bd.id)).toBe(false)

    const acmeActivities = await listAll(services.activities, acme.organization.id)
    const betaActivities = await listAll(services.activities, beta.organization.id)
    const acmeActivityIds = new Set(acmeActivities.map((r) => r.id))
    for (const ba of betaActivities) expect(acmeActivityIds.has(ba.id)).toBe(false)

    const acmeNotes = await listAll(services.notes, acme.organization.id)
    const betaNotes = await listAll(services.notes, beta.organization.id)
    const acmeNoteIds = new Set(acmeNotes.map((r) => r.id))
    for (const bn of betaNotes) expect(acmeNoteIds.has(bn.id)).toBe(false)
  }, 120_000)

  it('T3: result.counts matches actual DB counts for beta', async () => {
    const adapter = await freshAdapter()
    const result = await seed(adapter, { profile: TENANT_PROFILES.beta })
    const services = createCoreServices(adapter)
    const orgId = result.organization.id
    const contacts = await listAll(services.contacts, orgId)
    const companies = await listAll(services.companies, orgId)
    const deals = await listAll(services.deals, orgId)
    const activities = await listAll(services.activities, orgId)
    const notes = await listAll(services.notes, orgId)
    expect(contacts.length).toBe(result.counts.contacts)
    expect(companies.length).toBe(result.counts.companies)
    expect(deals.length).toBe(result.counts.deals)
    expect(activities.length).toBe(result.counts.activities)
    expect(notes.length).toBe(result.counts.notes)
  }, 90_000)

  it('T1: mode=append doubles the seeded row counts across entities', async () => {
    const adapter = await freshAdapter()
    const profile = TENANT_PROFILES.beta
    const first = await seed(adapter, { profile })
    // Append mode is documented as non-deterministic — use a distinct random
    // seed on the second run so users/contacts/etc. with uniqueness constraints
    // don't collide on the deterministic-by-default picks.
    await seed(adapter, { profile, mode: 'append', randomSeed: `${profile.randomSeed}-append` })
    const services = createCoreServices(adapter)
    const orgId = first.organization.id
    const contacts = await listAll(services.contacts, orgId)
    const companies = await listAll(services.companies, orgId)
    const deals = await listAll(services.deals, orgId)
    expect(contacts.length).toBe(profile.counts.contacts * 2)
    expect(companies.length).toBe(profile.counts.companies * 2)
    expect(deals.length).toBe(profile.counts.deals * 2)
  }, 120_000)

  it('T6: re-seeding with mode=reset leaves exactly one organization row for the slug', async () => {
    const adapter = await freshAdapter()
    const profile = TENANT_PROFILES.beta
    await seed(adapter, { profile })
    await seed(adapter, { profile, mode: 'reset' })
    const services = createCoreServices(adapter)
    // List all orgs in the system-level admin service and filter to this slug.
    // Admin ctx.orgId is ignored by the admin service; pass an arbitrary value.
    const all = await services.system.organizations.list({ orgId: 'admin' }, { limit: 100 })
    const matching = all.data.filter((o) => o.slug === profile.organizationSlug)
    expect(matching.length).toBe(1)
  }, 120_000)

  it('mode=fail-if-exists throws when org already has data', async () => {
    const adapter = await freshAdapter()
    await seed(adapter, { profile: TENANT_PROFILES.beta })
    await expect(
      seed(adapter, { profile: TENANT_PROFILES.beta }),
    ).rejects.toThrow(/already has data/)
  }, 90_000)

  it('mode=reset wipes and re-seeds to the same counts across all entity types', async () => {
    const adapter = await freshAdapter()
    const profile = TENANT_PROFILES.beta
    await seed(adapter, { profile })
    const r = await seed(adapter, {
      profile,
      mode: 'reset',
    })
    const services = createCoreServices(adapter)
    const orgId = r.organization.id
    const contacts = await listAll(services.contacts, orgId)
    const companies = await listAll(services.companies, orgId)
    const deals = await listAll(services.deals, orgId)
    const activities = await listAll(services.activities, orgId)
    const notes = await listAll(services.notes, orgId)
    expect(contacts.length).toBe(profile.counts.contacts)
    expect(companies.length).toBe(profile.counts.companies)
    expect(deals.length).toBe(profile.counts.deals)
    expect(activities.length).toBe(profile.counts.activities)
    expect(notes.length).toBe(profile.counts.notes)
  }, 120_000)
})
