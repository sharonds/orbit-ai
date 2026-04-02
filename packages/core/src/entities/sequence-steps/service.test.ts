import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemorySequenceStepRepository } from './repository.js'
import { createSequenceStepService } from './service.js'
import { createInMemorySequenceRepository } from '../sequences/repository.js'
import { createSequenceService } from '../sequences/service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const otherCtx = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

async function createSequenceGraph() {
  const sequences = createInMemorySequenceRepository()
  const sequenceSteps = createInMemorySequenceStepRepository()
  const sequenceService = createSequenceService({ sequences })
  const sequenceStepService = createSequenceStepService({ sequenceSteps, sequences })

  const primary = await sequenceService.create(ctx, {
    name: 'Outbound',
  })
  const secondary = await sequenceService.create(ctx, {
    name: 'Lifecycle',
  })

  return { sequenceService, sequenceStepService, primary, secondary, sequenceSteps }
}

describe('sequence step service', () => {
  it('creates ordered steps under a parent sequence and supports search', async () => {
    const { sequenceStepService, primary } = await createSequenceGraph()

    await sequenceStepService.create(ctx, {
      sequenceId: primary.id,
      stepOrder: 2,
      actionType: 'task',
      taskTitle: 'Call champion',
    })
    await sequenceStepService.create(ctx, {
      sequenceId: primary.id,
      stepOrder: 1,
      actionType: 'email',
      templateSubject: 'Welcome to Orbit',
    })

    const listed = await sequenceStepService.list(ctx, {
      filter: {
        sequence_id: primary.id,
      },
      limit: 10,
    })
    const search = await sequenceStepService.search(ctx, {
      query: 'welcome',
      limit: 10,
    })

    expect(listed.data.map((record) => record.stepOrder)).toEqual([1, 2])
    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.actionType).toBe('email')
  })

  it('rejects steps that reference a sequence outside the tenant scope', async () => {
    const { sequenceStepService } = await createSequenceGraph()

    await expect(
      sequenceStepService.create(ctx, {
        sequenceId: 'sequence_01ARYZ6S41YYYYYYYYYYYYYYYY',
        stepOrder: 1,
        actionType: 'email',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })

    await expect(
      sequenceStepService.create(ctx, {
        sequenceId: generateId('sequence'),
        stepOrder: 1,
        actionType: 'email',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('enforces unique step order per sequence while allowing reuse across different sequences', async () => {
    const { sequenceStepService, primary, secondary } = await createSequenceGraph()

    await sequenceStepService.create(ctx, {
      sequenceId: primary.id,
      stepOrder: 1,
      actionType: 'email',
    })

    await expect(
      sequenceStepService.create(ctx, {
        sequenceId: primary.id,
        stepOrder: 1,
        actionType: 'task',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'stepOrder',
    })

    await expect(
      sequenceStepService.create(ctx, {
        sequenceId: secondary.id,
        stepOrder: 1,
        actionType: 'task',
      }),
    ).resolves.toMatchObject({
      sequenceId: secondary.id,
    })
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemorySequenceStepRepository()
    const record = await repository.create(ctx, {
      id: generateId('sequenceStep'),
      organizationId: ctx.orgId,
      sequenceId: generateId('sequence'),
      stepOrder: 1,
      actionType: 'email',
      delayMinutes: 0,
      templateSubject: null,
      templateBody: null,
      taskTitle: null,
      taskDescription: null,
      metadata: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, record.id, {
        organizationId: otherCtx.orgId,
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })
})
