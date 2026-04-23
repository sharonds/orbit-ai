import {
  createSqliteOrganizationRepository,
  createPostgresOrganizationRepository,
  generateId,
  type StorageAdapter,
  type OrganizationRecord,
} from '@orbit-ai/core'
import type { TenantProfile } from '../profiles.js'

function orgRepositoryFor(adapter: StorageAdapter) {
  if (adapter.dialect === 'sqlite') return createSqliteOrganizationRepository(adapter)
  return createPostgresOrganizationRepository(adapter)
}

export interface SeededOrganization {
  readonly organization: OrganizationRecord
  /**
   * `true` if this call inserted a brand new row; `false` if an organization
   * with `profile.organizationSlug` already existed and was returned as-is.
   *
   * Callers of `seed(mode: 'reset')` must inspect this flag — resetting an
   * organization that the seeder did not create is destructive and requires
   * explicit opt-in (see SeedOptions.allowResetOfExistingOrg).
   */
  readonly created: boolean
}

export async function seedOrganization(
  adapter: StorageAdapter,
  profile: TenantProfile,
): Promise<SeededOrganization> {
  const repo = orgRepositoryFor(adapter)
  // Idempotency: search by slug before creating. SearchQuery (packages/core/src/types/api.ts)
  // accepts `filter` and `sort`, and `slug` is in filterableFields for organizations.
  const search = await repo.list({
    limit: 1,
    filter: { slug: profile.organizationSlug },
    sort: [{ field: 'created_at', direction: 'desc' }],
  })
  const existing = search.data[0]
  if (existing) return { organization: existing, created: false }

  const now = new Date()
  const record: OrganizationRecord = {
    id: generateId('organization'),
    name: profile.organizationName,
    slug: profile.organizationSlug,
    plan: 'community',
    isActive: true,
    settings: {},
    createdAt: now,
    updatedAt: now,
  }
  const created = await repo.create(record)
  return { organization: created, created: true }
}
