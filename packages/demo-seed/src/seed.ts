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
  /**
   * Opt-in safeguard for `mode: 'reset'` against organizations the seeder did
   * NOT just create. Defaults to `false`.
   *
   * The seeder matches organizations by a fixed profile slug (e.g.
   * `acme-events`, `beta-collective`). If a caller points the seeder at a
   * database that happens to contain an organization matching that slug (for
   * example a real customer named "Acme Events"), `resetSeed` would wipe
   * their tenant data. Requiring this flag forces callers to explicitly
   * acknowledge that risk rather than trip over it by accident.
   *
   * Set to `true` only when you KNOW the matching organization is a
   * seed-created demo tenant and losing its data is intentional.
   */
  readonly allowResetOfExistingOrg?: boolean
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

  const { organization, created: organizationCreated } = await seedOrganization(adapter, profile)
  const services = createCoreServices(adapter)
  const ctx = { orgId: organization.id }

  // Safety gate for P1-1: if we are about to wipe an organization that the
  // current seed() call did NOT just create, require explicit opt-in. Without
  // this, a caller who points `mode: 'reset'` at a database that happens to
  // contain a real tenant with a matching slug would silently lose that
  // tenant's data.
  if (mode === 'reset' && !organizationCreated && opts.allowResetOfExistingOrg !== true) {
    throw new Error(
      `seed: refusing to reset organization '${organization.slug}' because it pre-existed ` +
        `and allowResetOfExistingOrg was not set. ` +
        `This is a destructive operation — pass allowResetOfExistingOrg: true to opt in, ` +
        `or use mode: 'append' instead.`,
    )
  }

  // Check existing data, enforce mode. Include users alongside pipelines and
  // contacts so a partial prior seed (users created but failed before
  // pipelines/contacts) does not silently bypass the fail-if-exists guard.
  // seedUsers runs first in the orchestrator, so a crash between users and
  // pipelines would leave only users behind.
  const existingUsers = await services.users.list(ctx, { limit: 1 })
  const existingPipelines = await services.pipelines.list(ctx, { limit: 1 })
  const existingContacts = await services.contacts.list(ctx, { limit: 1 })
  const hasExistingData =
    existingUsers.data.length > 0 ||
    existingPipelines.data.length > 0 ||
    existingContacts.data.length > 0
  if (hasExistingData) {
    if (mode === 'fail-if-exists') {
      throw new Error(
        `seed: organization ${organization.slug} already has data ` +
          `(users=${existingUsers.data.length}, pipelines=${existingPipelines.data.length}, contacts=${existingContacts.data.length}). ` +
          `Pass mode: 'reset' to wipe + reseed, or 'append' to add on top.`,
      )
    }
    if (mode === 'reset') {
      const { resetSeed } = await import('./reset.js')
      await resetSeed(adapter, organization.id)
      // Post-reset verification: confirm reset actually emptied users,
      // pipelines, AND contacts. Closes the loop with the progress-guard
      // in resetSeed.
      const postUsers = await services.users.list(ctx, { limit: 1 })
      const postPipelines = await services.pipelines.list(ctx, { limit: 1 })
      const postContacts = await services.contacts.list(ctx, { limit: 1 })
      if (
        postUsers.data.length > 0 ||
        postPipelines.data.length > 0 ||
        postContacts.data.length > 0
      ) {
        throw new Error(
          `seed: resetSeed completed but organization ${organization.slug} is not empty ` +
            `(users=${postUsers.data.length}, pipelines=${postPipelines.data.length}, contacts=${postContacts.data.length})`,
        )
      }
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
