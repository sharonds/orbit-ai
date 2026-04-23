import type {
  CoreServices,
  OrbitAuthContext,
  PipelineRecord,
  StageRecord,
} from '@orbit-ai/core'
import { DEFAULT_PIPELINE_STAGES } from '../fixtures/stages.js'

export async function seedPipelinesAndStages(
  services: CoreServices,
  ctx: OrbitAuthContext,
): Promise<{ pipeline: PipelineRecord; stages: StageRecord[] }> {
  const pipeline = await services.pipelines.create(ctx, { name: 'Default Sales Pipeline' })
  const stages: StageRecord[] = []
  for (const fx of DEFAULT_PIPELINE_STAGES) {
    const stage = await services.stages.create(ctx, {
      pipelineId: pipeline.id,
      name: fx.name,
      stageOrder: fx.stageOrder,
      probability: fx.probability,
      isWon: fx.isWon,
      isLost: fx.isLost,
    })
    stages.push(stage)
  }
  return { pipeline, stages }
}
