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
import { DEFAULT_PIPELINE_STAGES } from '../fixtures/stages.js'

function pickStageByWeight(stages: StageRecord[], prng: Prng): StageRecord {
  const roll = prng.float()
  let acc = 0
  for (let i = 0; i < DEFAULT_PIPELINE_STAGES.length; i += 1) {
    acc += DEFAULT_PIPELINE_STAGES[i]!.weight
    if (roll < acc) return stages[i]!
  }
  return stages[stages.length - 1]!
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
  const out: DealRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const company = prng.pickOne(companies)
    const stage = pickStageByWeight(stages, prng)
    const primaryContact = contacts.find((c) => c.companyId === company.id) ?? contacts[0]!
    // core's deals.value is a money column (numeric(18,2)) — pass a string amount.
    const value = `${prng.intBetween(500, 20000)}.00`
    const status = stage.isWon ? 'won' : stage.isLost ? 'lost' : 'open'
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
