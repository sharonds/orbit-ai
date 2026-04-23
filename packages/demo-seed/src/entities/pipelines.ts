import type {
  CoreServices,
  OrbitAuthContext,
  PipelineRecord,
  StageRecord,
} from '@orbit-ai/core'
import { DEFAULT_PIPELINE_STAGES } from '../fixtures/stages.js'

const DEFAULT_PIPELINE_NAME = 'Default Sales Pipeline'

export async function seedPipelinesAndStages(
  services: CoreServices,
  ctx: OrbitAuthContext,
): Promise<{ pipeline: PipelineRecord; stages: StageRecord[] }> {
  // Append-mode idempotency: pipelines have a unique (org, name) index on
  // Postgres. On SQLite the constraint is absent — but a second un-named
  // "Default Sales Pipeline" would still be a user-visible duplicate. Re-use
  // an existing pipeline of this name if present on either dialect.
  const pipeline = await findOrCreatePipeline(services, ctx)

  // Same pattern for stages — a previous partial run may have created some
  // stages already. Only create the missing ones, matched by `name`. Stage
  // names are stable across seeder runs so this is deterministic.
  const existingStages = await findAllStagesForPipeline(services, ctx, pipeline.id)
  const existingByName = new Map(existingStages.map((s) => [s.name, s]))
  const stages: StageRecord[] = []
  for (const fx of DEFAULT_PIPELINE_STAGES) {
    const prior = existingByName.get(fx.name)
    if (prior) {
      stages.push(prior)
      continue
    }
    const stage = await services.stages.create(ctx, {
      pipelineId: pipeline.id,
      name: fx.name,
      stageOrder: fx.stageOrder,
      probability: fx.probability,
      isWon: fx.kind === 'won',
      isLost: fx.kind === 'lost',
    })
    stages.push(stage)
  }
  return { pipeline, stages }
}

async function findOrCreatePipeline(
  services: CoreServices,
  ctx: OrbitAuthContext,
): Promise<PipelineRecord> {
  // `name` is a filterable field on pipelines (see pipelines/repository.ts).
  const found = await services.pipelines.list(ctx, {
    limit: 1,
    filter: { name: DEFAULT_PIPELINE_NAME },
  })
  if (found.data[0]) return found.data[0]
  return services.pipelines.create(ctx, { name: DEFAULT_PIPELINE_NAME })
}

async function findAllStagesForPipeline(
  services: CoreServices,
  ctx: OrbitAuthContext,
  pipelineId: string,
): Promise<StageRecord[]> {
  // `pipeline_id` is a filterable field on stages (see stages/repository.ts).
  // Stage count per pipeline is small (5 in DEFAULT_PIPELINE_STAGES); one
  // page at the MAX_LIST_LIMIT of 100 is sufficient. Paginate defensively
  // in case a future fixture balloons or a consumer appended extra stages.
  const out: StageRecord[] = []
  let cursor: string | undefined
  for (let i = 0; i < 100; i += 1) {
    const page = await services.stages.list(ctx, {
      limit: 100,
      filter: { pipeline_id: pipelineId },
      ...(cursor ? { cursor } : {}),
    })
    out.push(...page.data)
    if (!page.nextCursor || page.data.length === 0) return out
    cursor = page.nextCursor
  }
  return out
}
