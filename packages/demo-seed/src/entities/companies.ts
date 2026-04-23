import type { CompanyRecord, CoreServices, OrbitAuthContext } from '@orbit-ai/core'
import type { Prng } from '../prng.js'
import { COMPANY_FIXTURES } from '../fixtures/companies.js'
import { EMAIL_DOMAIN_TEMPLATES, slugify } from '../fixtures/domains.js'

export async function seedCompanies(
  services: CoreServices,
  ctx: OrbitAuthContext,
  prng: Prng,
  count: number,
): Promise<CompanyRecord[]> {
  if (count > COMPANY_FIXTURES.length) {
    throw new RangeError(`seedCompanies: count ${count} > fixtures ${COMPANY_FIXTURES.length}`)
  }
  const picked = prng.pickMany(COMPANY_FIXTURES, count)
  const out: CompanyRecord[] = []
  for (const fx of picked) {
    const template = prng.pickOne(EMAIL_DOMAIN_TEMPLATES)
    const domain = template.replace('{slug}', slugify(fx.name))
    const company = await services.companies.create(ctx, {
      name: fx.name,
      domain,
      industry: fx.industry,
      size: fx.sizeHint,
      website: `https://www.${domain}`,
    })
    out.push(company)
  }
  return out
}
