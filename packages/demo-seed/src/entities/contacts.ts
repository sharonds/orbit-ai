import type { CompanyRecord, ContactRecord, CoreServices, OrbitAuthContext } from '@orbit-ai/core'
import type { Prng } from '../prng.js'
import { FIRST_NAMES, LAST_NAMES } from '../fixtures/names.js'
import { emailLocalPart } from '../util.js'

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
    if (!company.domain) {
      // seedCompanies() always sets a domain. A missing domain here means the
      // invariant was broken elsewhere — fail loudly rather than fall back.
      throw new Error(
        `seedContacts: company ${company.id} (${company.name}) is missing a domain — seedCompanies must always set one`,
      )
    }
    const email = `${emailLocalPart(first)}.${emailLocalPart(last)}.${i}@${company.domain}`
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
