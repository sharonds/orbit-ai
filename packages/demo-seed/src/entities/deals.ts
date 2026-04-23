import type {
  CompanyRecord,
  ContactRecord,
  CoreServices,
  DealRecord,
  OrbitAuthContext,
  PipelineRecord,
  StageRecord,
} from '@orbit-ai/core'
import type { Prng } from '../prng.js'
import { DEFAULT_PIPELINE_STAGES, type StageFixture } from '../fixtures/stages.js'

function pickStageByWeight(
  stages: StageRecord[],
  prng: Prng,
): { stage: StageRecord; fixture: StageFixture } {
  const roll = prng.float()
  let acc = 0
  for (let i = 0; i < DEFAULT_PIPELINE_STAGES.length; i += 1) {
    const fixture = DEFAULT_PIPELINE_STAGES[i]!
    acc += fixture.weight
    if (roll < acc) return { stage: stages[i]!, fixture }
  }
  const lastIdx = DEFAULT_PIPELINE_STAGES.length - 1
  return { stage: stages[lastIdx]!, fixture: DEFAULT_PIPELINE_STAGES[lastIdx]! }
}

export async function seedDeals(
  services: CoreServices,
  ctx: OrbitAuthContext,
  prng: Prng,
  pipeline: PipelineRecord,
  stages: StageRecord[],
  companies: CompanyRecord[],
  contacts: ContactRecord[],
  count: number,
): Promise<DealRecord[]> {
  if (companies.length === 0) throw new RangeError('seedDeals: need at least one company')
  if (contacts.length === 0) throw new RangeError('seedDeals: need at least one contact')
  if (stages.length === 0) throw new RangeError('seedDeals: need at least one stage')
  if (DEFAULT_PIPELINE_STAGES.length !== stages.length) {
    throw new Error(
      `seedDeals: stages length (${stages.length}) does not match fixture length (${DEFAULT_PIPELINE_STAGES.length})`,
    )
  }
  // Restrict company pool to those that have at least one contact — picking a
  // company with no contacts would force a cross-org-looking link where the
  // deal's contactId references a contact at a different company. Loud throw
  // if no such company exists rather than silently picking contacts[0].
  const contactsByCompany = new Map<string, ContactRecord[]>()
  for (const c of contacts) {
    const bucket = contactsByCompany.get(c.companyId ?? '')
    if (bucket) bucket.push(c)
    else contactsByCompany.set(c.companyId ?? '', [c])
  }
  const eligibleCompanies = companies.filter((co) => (contactsByCompany.get(co.id)?.length ?? 0) > 0)
  if (eligibleCompanies.length === 0) {
    throw new Error(
      'seedDeals: no company has any contacts — refusing to create deals with cross-company contact links',
    )
  }
  const out: DealRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const company = prng.pickOne(eligibleCompanies)
    const { stage, fixture } = pickStageByWeight(stages, prng)
    const companyContacts = contactsByCompany.get(company.id)
    if (!companyContacts || companyContacts.length === 0) {
      // Invariant: eligibleCompanies filters to >0, so this is unreachable.
      throw new Error(
        `seedDeals: invariant violation — company ${company.id} has no contacts`,
      )
    }
    const primaryContact = prng.pickOne(companyContacts)
    // core's deals.value is a money column (numeric(18,2)) — pass a string amount.
    const value = `${prng.intBetween(500, 20000)}.00`
    const status: 'won' | 'lost' | 'open' = fixture.kind
    const deal = await services.deals.create(ctx, {
      title: `${company.name} — Q2 ${i + 1}`,
      value,
      currency: 'USD',
      pipelineId: pipeline.id,
      stageId: stage.id,
      contactId: primaryContact.id,
      companyId: company.id,
      status,
    })
    out.push(deal)
  }
  return out
}
