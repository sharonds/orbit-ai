export type StageKind = 'open' | 'won' | 'lost'

export interface StageFixture {
  readonly name: string
  readonly stageOrder: number
  readonly probability: number
  readonly weight: number // relative distribution for deals
  readonly kind: StageKind
}

export const DEFAULT_PIPELINE_STAGES: readonly StageFixture[] = [
  { name: 'Prospecting',   stageOrder: 1, probability: 10,  weight: 0.40, kind: 'open' },
  { name: 'Qualification', stageOrder: 2, probability: 30,  weight: 0.25, kind: 'open' },
  { name: 'Proposal',      stageOrder: 3, probability: 60,  weight: 0.15, kind: 'open' },
  { name: 'Closed Won',    stageOrder: 4, probability: 100, weight: 0.12, kind: 'won'  },
  { name: 'Closed Lost',   stageOrder: 5, probability: 0,   weight: 0.08, kind: 'lost' },
]

/**
 * Module-init invariant check. Validates the fixture is internally consistent
 * so a future edit can't silently produce a malformed pipeline spec.
 *
 * Rules:
 *   - weights sum to ~1.0 (within 1e-9)
 *   - stageOrder is strictly [1, 2, …, n]
 *   - probability ∈ [0, 100]
 *   - exactly one stage with kind='won' and one with kind='lost'
 */
function validateStageFixtures(stages: readonly StageFixture[]): void {
  if (stages.length === 0) {
    throw new Error('DEFAULT_PIPELINE_STAGES: must contain at least one stage')
  }
  const weightSum = stages.reduce((acc, s) => acc + s.weight, 0)
  if (Math.abs(weightSum - 1) > 1e-9) {
    throw new Error(
      `DEFAULT_PIPELINE_STAGES: weights must sum to 1.0 (got ${weightSum})`,
    )
  }
  let wonCount = 0
  let lostCount = 0
  for (let i = 0; i < stages.length; i += 1) {
    const s = stages[i]!
    if (s.stageOrder !== i + 1) {
      throw new Error(
        `DEFAULT_PIPELINE_STAGES: stageOrder must be strictly [1..n]; index ${i} has stageOrder ${s.stageOrder}`,
      )
    }
    if (s.probability < 0 || s.probability > 100) {
      throw new Error(
        `DEFAULT_PIPELINE_STAGES: probability must be in [0,100]; '${s.name}' has ${s.probability}`,
      )
    }
    if (s.kind === 'won') wonCount += 1
    if (s.kind === 'lost') lostCount += 1
  }
  if (wonCount !== 1) {
    throw new Error(
      `DEFAULT_PIPELINE_STAGES: must have exactly 1 stage with kind='won' (got ${wonCount})`,
    )
  }
  if (lostCount !== 1) {
    throw new Error(
      `DEFAULT_PIPELINE_STAGES: must have exactly 1 stage with kind='lost' (got ${lostCount})`,
    )
  }
}

validateStageFixtures(DEFAULT_PIPELINE_STAGES)
