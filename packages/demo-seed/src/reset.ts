import { createCoreServices } from '@orbit-ai/core'
import type { StorageAdapter } from '@orbit-ai/core'

/**
 * Exactly the entities that seed() writes. If a new entity is added to seed(),
 * add it here too. Ordering respects FK constraints: children first.
 *
 * Note: `tasks` is intentionally included even though the current `seed()`
 * orchestrator does not populate tasks — this is defensive so that a caller
 * who manually adds tasks to a seeded tenant still gets a clean reset.
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
  'tags',
  'users',
] as const

type ListDeleteService = {
  list: (
    ctx: { orgId: string },
    q: { limit: number },
  ) => Promise<{ data: Array<{ id: string }> }>
  delete: (ctx: { orgId: string }, id: string) => Promise<unknown>
}

export async function resetSeed(
  adapter: StorageAdapter,
  organizationId: string,
): Promise<void> {
  const services = createCoreServices(adapter)
  const ctx = { orgId: organizationId }
  for (const name of ENTITIES_IN_DELETE_ORDER) {
    const svc = (services as unknown as Record<string, ListDeleteService | undefined>)[name]
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
    while (page.data.length > 0) {
      for (const record of page.data) {
        try {
          await svc.delete(ctx, record.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(
            `resetSeed: failed to delete ${name} ${record.id}: ${message}`,
          )
        }
      }
      page = await svc.list(ctx, { limit: 100 })
    }
  }
  // Note: organization itself is left intact — resetting data, not the tenant.
}
