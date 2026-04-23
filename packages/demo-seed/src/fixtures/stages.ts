export interface StageFixture {
  readonly name: string
  readonly stageOrder: number
  readonly probability: number
  readonly weight: number // relative distribution for deals
  readonly isWon: boolean
  readonly isLost: boolean
}

export const DEFAULT_PIPELINE_STAGES: readonly StageFixture[] = [
  { name: 'Prospecting',   stageOrder: 1, probability: 10,  weight: 0.40, isWon: false, isLost: false },
  { name: 'Qualification', stageOrder: 2, probability: 30,  weight: 0.25, isWon: false, isLost: false },
  { name: 'Proposal',      stageOrder: 3, probability: 60,  weight: 0.15, isWon: false, isLost: false },
  { name: 'Closed Won',    stageOrder: 4, probability: 100, weight: 0.12, isWon: true,  isLost: false },
  { name: 'Closed Lost',   stageOrder: 5, probability: 0,   weight: 0.08, isWon: false, isLost: true  },
]
