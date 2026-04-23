import type { CoreServices, OrbitAuthContext, TagRecord } from '@orbit-ai/core'

const TAG_NAMES = ['hot-lead', 'enterprise', 'eu', 'partner', 'champion'] as const

export async function seedTags(
  services: CoreServices,
  ctx: OrbitAuthContext,
): Promise<TagRecord[]> {
  // Tag names have a per-org uniqueness constraint. For each seeded name,
  // fetch it directly via `filter: { name }` — `name` is a filterable field
  // on tags (see tags/repository.ts). This avoids the 100-row pagination cap
  // that would otherwise silently skip the seed names in orgs with >100 tags
  // and then re-hit the unique constraint on create.
  const out: TagRecord[] = []
  for (const name of TAG_NAMES) {
    const existing = await services.tags.list(ctx, { limit: 1, filter: { name } })
    const prior = existing.data[0]
    if (prior) {
      out.push(prior)
      continue
    }
    const tag = await services.tags.create(ctx, { name })
    out.push(tag)
  }
  return out
}
