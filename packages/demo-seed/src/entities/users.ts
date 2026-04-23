import type { CoreServices, OrbitAuthContext, SanitizedUserRecord } from '@orbit-ai/core'
import type { Prng } from '../prng.js'
import { FIRST_NAMES, LAST_NAMES } from '../fixtures/names.js'
import { emailLocalPart } from '../util.js'

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
    // Strip spaces/punctuation so names like "De Boer" still yield a
    // syntactically valid Zod-parseable email. `.local` is non-routable
    // per RFC 6762 (multicast DNS).
    const email = `${emailLocalPart(first)}.${emailLocalPart(last)}+demo${i}@orbit-demo.local`
    const user = await services.users.create(ctx, {
      email,
      name: `${first} ${last}`,
      role: i === 0 ? 'admin' : 'member',
    })
    out.push(user)
  }
  return out
}
