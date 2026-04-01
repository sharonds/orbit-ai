import { describe, expect, it } from 'vitest'

import { createInMemoryPipelineRepository } from '../pipelines/repository.js'
import { createInMemoryStageRepository } from './repository.js'
import { createStageService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('stage service', () => {
  it('rejects stages that reference pipelines outside the org scope', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const service = createStageService({ stages, pipelines })

    await expect(
      service.create(ctx, {
        pipelineId: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Qualified',
        stageOrder: 1,
        probability: 30,
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('rejects stage updates that move to a missing pipeline', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const service = createStageService({ stages, pipelines })
    const pipeline = await pipelines.create(ctx, {
      id: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Sales',
      isDefault: true,
      description: null,
      createdAt: new Date('2026-03-31T13:00:00.000Z'),
      updatedAt: new Date('2026-03-31T13:00:00.000Z'),
    })
    const stage = await service.create(ctx, {
      pipelineId: pipeline.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 30,
    })

    await expect(
      service.update(ctx, stage.id, {
        pipelineId: 'pipeline_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })
})
