import type { CoreServices, OrbitAuthContext, SanitizedUserRecord } from '@orbit-ai/core'
import type { Prng } from '../prng.js'
import { FIRST_NAMES, LAST_NAMES } from '../fixtures/names.js'

export async function seedUsers(
  services: CoreServices,
  ctx: OrbitAuthContext,
  prng: Prng,
  count: number,
): Promise<SanitizedUserRecord[]> {
  const out: SanitizedUserRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const first = prng.pickOne(FIRST_NAMES)
    const last = prng.pickOne(LAST_NAMES)
    const email = `${first.toLowerCase()}.${last.toLowerCase()}+demo${i}@orbit-demo.local`
    const user = await services.users.create(ctx, {
      email,
      name: `${first} ${last}`,
      role: i === 0 ? 'admin' : 'member',
    })
    out.push(user)
  }
  return out
}
