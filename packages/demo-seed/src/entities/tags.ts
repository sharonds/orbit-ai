import type { CoreServices, OrbitAuthContext, TagRecord } from '@orbit-ai/core'

const TAG_NAMES = ['hot-lead', 'enterprise', 'eu', 'partner', 'champion'] as const

export async function seedTags(
  services: CoreServices,
  ctx: OrbitAuthContext,
): Promise<TagRecord[]> {
  // Tag names have a per-org uniqueness constraint. Fetch existing tags first
  // so append-mode re-runs skip names already present rather than throwing.
  const existing = await services.tags.list(ctx, { limit: 100 })
  const existingByName = new Map(existing.data.map((t) => [t.name, t]))
  const out: TagRecord[] = []
  for (const name of TAG_NAMES) {
    const prior = existingByName.get(name)
    if (prior) {
      out.push(prior)
      continue
    }
    const tag = await services.tags.create(ctx, { name })
    out.push(tag)
  }
  return out
}
