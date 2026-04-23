import type { CompanyRecord, ContactRecord, CoreServices, OrbitAuthContext } from '@orbit-ai/core'
import type { Prng } from '../prng.js'
import { FIRST_NAMES, LAST_NAMES } from '../fixtures/names.js'

const TITLES = ['VP Sales', 'Head of Ops', 'Founder', 'CTO', 'Product Lead', 'CEO', 'Account Exec'] as const

export async function seedContacts(
  services: CoreServices,
  ctx: OrbitAuthContext,
  prng: Prng,
  companies: CompanyRecord[],
  count: number,
): Promise<ContactRecord[]> {
  if (companies.length === 0) throw new RangeError('seedContacts: need at least one company')
  const out: ContactRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const first = prng.pickOne(FIRST_NAMES)
    const last = prng.pickOne(LAST_NAMES)
    const company = prng.pickOne(companies)
    const domain = company.domain ?? 'example.com'
    const email = `${first.toLowerCase()}.${last.toLowerCase()}.${i}@${domain}`
    const contact = await services.contacts.create(ctx, {
      name: `${first} ${last}`,
      email,
      title: prng.pickOne(TITLES),
      companyId: company.id,
    })
    out.push(contact)
  }
  return out
}
