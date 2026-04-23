import type { CoreServices, OrbitAuthContext, TagRecord } from '@orbit-ai/core'

const TAG_NAMES = ['hot-lead', 'enterprise', 'eu', 'partner', 'champion'] as const

export async function seedTags(
  services: CoreServices,
  ctx: OrbitAuthContext,
): Promise<TagRecord[]> {
  const out: TagRecord[] = []
  for (const name of TAG_NAMES) {
    const tag = await services.tags.create(ctx, { name })
    out.push(tag)
  }
  return out
}
