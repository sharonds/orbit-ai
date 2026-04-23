import { createCoreServices } from '@orbit-ai/core'
import type { OrganizationRecord, StorageAdapter } from '@orbit-ai/core'
import type { TenantProfile } from './profiles.js'
import { createPrng } from './prng.js'
import { seedOrganization } from './entities/organizations.js'
import { seedUsers } from './entities/users.js'
import { seedPipelinesAndStages } from './entities/pipelines.js'
import { seedCompanies } from './entities/companies.js'
import { seedContacts } from './entities/contacts.js'
import { seedDeals } from './entities/deals.js'
import { seedActivities } from './entities/activities.js'
import { seedNotes } from './entities/notes.js'
import { seedTags } from './entities/tags.js'

export type SeedMode = 'reset' | 'append' | 'fail-if-exists'

export interface SeedOptions {
  readonly profile: TenantProfile
  readonly now?: number
  readonly randomSeed?: string
  /**
   * How to handle an already-seeded org:
   * - `fail-if-exists` (default) — throw if org already has data; forces callers to opt into behavior.
   * - `reset` — call resetSeed() first, then re-seed deterministically.
   * - `append` — seed on top of existing data (non-deterministic; only for explicit "grow" use cases).
   */
  readonly mode?: SeedMode
}

export interface SeedResult {
  readonly organization: OrganizationRecord
  readonly counts: {
    readonly contacts: number
    readonly companies: number
    readonly deals: number
    readonly activities: number
    readonly notes: number
  }
}

export async function seed(
  adapter: StorageAdapter,
  opts: SeedOptions,
): Promise<SeedResult> {
  const { profile } = opts
  const mode: SeedMode = opts.mode ?? 'fail-if-exists'
  const randomSeed = opts.randomSeed ?? profile.randomSeed
  const now = opts.now ?? Date.now()
  const prng = createPrng(randomSeed)

  const organization = await seedOrganization(adapter, profile)
  const services = createCoreServices(adapter)
  const ctx = { orgId: organization.id }

  // Check existing data, enforce mode.
  const existing = await services.contacts.list(ctx, { limit: 1 })
  if (existing.data.length > 0) {
    if (mode === 'fail-if-exists') {
      throw new Error(
        `seed: organization ${organization.slug} already has data. ` +
          `Pass mode: 'reset' to wipe + reseed, or 'append' to add on top.`,
      )
    }
    if (mode === 'reset') {
      const { resetSeed } = await import('./reset.js')
      await resetSeed(adapter, organization.id)
    }
    // mode === 'append' falls through with no cleanup.
  }

  await seedUsers(services, ctx, prng, 3)
  const { pipeline, stages } = await seedPipelinesAndStages(services, ctx)
  const companies = await seedCompanies(services, ctx, prng, profile.counts.companies)
  const contacts = await seedContacts(services, ctx, prng, companies, profile.counts.contacts)
  await seedDeals(
    services,
    ctx,
    prng,
    pipeline,
    stages,
    companies,
    contacts,
    profile.counts.deals,
  )
  await seedActivities(
    services,
    ctx,
    prng,
    contacts,
    profile.counts.activities,
    profile.historyDays,
    now,
  )
  await seedNotes(services, ctx, prng, contacts, profile.counts.notes)
  await seedTags(services, ctx)

  return { organization, counts: profile.counts }
}
