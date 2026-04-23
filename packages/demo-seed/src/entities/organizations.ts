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

export async function seedOrganization(
  adapter: StorageAdapter,
  profile: TenantProfile,
): Promise<OrganizationRecord> {
  const repo = orgRepositoryFor(adapter)
  // Idempotency: search by slug before creating. SearchQuery (packages/core/src/types/api.ts)
  // accepts `filter` and `sort`, and `slug` is in filterableFields for organizations.
  const search = await repo.list({
    limit: 1,
    filter: { slug: profile.organizationSlug },
    sort: [{ field: 'created_at', direction: 'desc' }],
  })
  const existing = search.data[0]
  if (existing) return existing

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
  return repo.create(record)
}
