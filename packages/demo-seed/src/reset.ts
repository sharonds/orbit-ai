import {
  createCoreServices,
  createSqliteEntityTagRepository,
  createPostgresEntityTagRepository,
} from '@orbit-ai/core'
import type {
  CoreServices,
  EntityTagRepository,
  StorageAdapter,
} from '@orbit-ai/core'

/**
 * Exactly the entities that seed() writes. If a new entity is added to seed(),
 * add it here too. Ordering respects FK constraints: children first.
 *
 * Note: `tasks` is intentionally included even though the current `seed()`
 * orchestrator does not populate tasks — this is defensive so that a caller
 * who manually adds tasks to a seeded tenant still gets a clean reset.
 *
 * `entityTags` (the `entity_tags` junction table) MUST come before `tags`
 * because entity_tags has a FK to tags — deleting a tag that still has
 * rows referencing it would fail with a FK violation on Postgres. The
 * seeder itself never creates entity_tag rows, but a consumer may have
 * associated tags with contacts/companies/etc. and still expect a clean
 * resetSeed to finish.
 *
 * `entityTags` is a sentinel name handled separately below (not routed
 * through CoreServices, since `services.system.entityTags` is read-only).
 *
 * Typed as `keyof CoreServices | 'entityTags'` so renames in core produce
 * a compile error here rather than a runtime "missing list/delete" throw.
 */
const ENTITIES_IN_DELETE_ORDER = [
  'activities',
  'notes',
  'tasks',
  'deals',
  'contacts',
  'stages',
  'pipelines',
  'companies',
  'entityTags',
  'tags',
  'users',
] as const satisfies readonly (keyof CoreServices | 'entityTags')[]

type DeletableEntity = (typeof ENTITIES_IN_DELETE_ORDER)[number]

type ListDeleteService = {
  list: (
    ctx: { orgId: string },
    q: { limit: number },
  ) => Promise<{ data: Array<{ id: string }> }>
  delete: (ctx: { orgId: string }, id: string) => Promise<unknown>
}

function entityTagRepositoryFor(adapter: StorageAdapter): EntityTagRepository {
  if (adapter.dialect === 'sqlite') return createSqliteEntityTagRepository(adapter)
  return createPostgresEntityTagRepository(adapter)
}

export async function resetSeed(
  adapter: StorageAdapter,
  organizationId: string,
): Promise<void> {
  const services = createCoreServices(adapter)
  const ctx = { orgId: organizationId }

  // `entityTags` is exposed on CoreServices only as a read-only admin surface
  // (`services.system.entityTags` has no `delete`). To clear FK-dependent
  // junction rows we must talk to the tenant-scoped repository directly.
  const entityTagRepository = entityTagRepositoryFor(adapter)

  // Build a typed dispatch map so a missing key is a compile error in most
  // cases and a runtime throw in the remaining (lazy-getter) ones.
  const deletableServices: Record<DeletableEntity, unknown> = {
    activities: services.activities,
    notes: services.notes,
    tasks: services.tasks,
    deals: services.deals,
    contacts: services.contacts,
    stages: services.stages,
    pipelines: services.pipelines,
    companies: services.companies,
    entityTags: entityTagRepository,
    tags: services.tags,
    users: services.users,
  }

  for (const name of ENTITIES_IN_DELETE_ORDER) {
    const svc = deletableServices[name] as ListDeleteService | undefined
    if (
      !svc ||
      typeof svc.list !== 'function' ||
      typeof svc.delete !== 'function'
    ) {
      // Fail LOUDLY — silent partial deletion leaves demo data behind and is a reset-API footgun.
      throw new Error(
        `resetSeed: service '${name}' is missing list/delete. ` +
          `Either update ENTITIES_IN_DELETE_ORDER or restore the service before calling resetSeed.`,
      )
    }
    let page = await svc.list(ctx, { limit: 100 })
    let previousFirstId: string | undefined
    let previousLength = -1
    while (page.data.length > 0) {
      const currentFirstId = page.data[0]!.id
      const currentLength = page.data.length
      // Progress guard: if a full pass completed without the set shrinking
      // (same head id and same length), the delete is failing silently. Throw
      // rather than loop forever.
      if (
        previousFirstId !== undefined &&
        previousFirstId === currentFirstId &&
        previousLength === currentLength
      ) {
        throw new Error(
          `resetSeed: no progress deleting ${name} for org ${organizationId} — ` +
            `first id ${currentFirstId} and length ${currentLength} unchanged after a full pass. ` +
            `Delete is succeeding without removing records (check adapter / RLS).`,
        )
      }
      for (const record of page.data) {
        try {
          await svc.delete(ctx, record.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(
            `resetSeed: failed to delete ${name} ${record.id}: ${message}`,
            { cause: err },
          )
        }
      }
      previousFirstId = currentFirstId
      previousLength = currentLength
      page = await svc.list(ctx, { limit: 100 })
    }
  }
  // Note: organization itself is left intact — resetting data, not the tenant.
}
