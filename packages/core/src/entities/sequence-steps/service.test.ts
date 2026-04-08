import { describe, expect, it } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { generateId } from '../../ids/generate-id.js'
import { createInMemorySequenceEnrollmentRepository } from '../sequence-enrollments/repository.js'
import { createSequenceEnrollmentService } from '../sequence-enrollments/service.js'
import { createInMemorySequenceEventRepository } from '../sequence-events/repository.js'
import { createSequenceEventService } from '../sequence-events/service.js'
import { createInMemorySequenceStepRepository } from './repository.js'
import { createSequenceStepService } from './service.js'
import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createContactService } from '../contacts/service.js'
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
  const sequenceEvents = createInMemorySequenceEventRepository()
  const sequenceEnrollments = createInMemorySequenceEnrollmentRepository()
  const sequenceService = createSequenceService({
    sequences,
    sequenceSteps,
    sequenceEnrollments,
    tx: createNoopTransactionScope(),
  })
  const sequenceStepService = createSequenceStepService({ sequenceSteps, sequences, sequenceEvents })

  const primary = await sequenceService.create(ctx, {
    name: 'Outbound',
  })
  const secondary = await sequenceService.create(ctx, {
    name: 'Lifecycle',
  })

  return { sequenceService, sequenceStepService, primary, secondary, sequenceSteps }
}

async function createGraphWithHistory() {
  const companies = createInMemoryCompanyRepository()
  const contacts = createInMemoryContactRepository()
  const sequences = createInMemorySequenceRepository()
  const sequenceSteps = createInMemorySequenceStepRepository()
  const sequenceEnrollments = createInMemorySequenceEnrollmentRepository()
  const sequenceEvents = createInMemorySequenceEventRepository()

  const companyService = createCompanyService(companies)
  const contactService = createContactService({ contacts, companies })
  const sequenceService = createSequenceService({
    sequences,
    sequenceSteps,
    sequenceEnrollments,
    tx: createNoopTransactionScope(),
  })
  const sequenceStepService = createSequenceStepService({ sequenceSteps, sequences, sequenceEvents })
  const sequenceEnrollmentService = createSequenceEnrollmentService({
    sequenceEnrollments,
    sequences,
    contacts,
    sequenceEvents,
  })
  const sequenceEventService = createSequenceEventService({
    sequenceEvents,
    sequenceEnrollments,
    sequenceSteps,
  })

  const company = await companyService.create(ctx, { name: 'Orbit Labs' })
  const contact = await contactService.create(ctx, {
    name: 'Taylor',
    email: 'taylor@orbit.test',
    companyId: company.id,
  })
  const sequence = await sequenceService.create(ctx, { name: 'Outbound' })
  const secondary = await sequenceService.create(ctx, { name: 'Lifecycle' })
  const step = await sequenceStepService.create(ctx, {
    sequenceId: sequence.id,
    stepOrder: 1,
    actionType: 'email',
  })
  const enrollment = await sequenceEnrollmentService.create(ctx, {
    sequenceId: sequence.id,
    contactId: contact.id,
  })
  await sequenceEventService.create(ctx, {
    sequenceEnrollmentId: enrollment.id,
    sequenceStepId: step.id,
    eventType: 'step.entered',
  })

  return { sequenceStepService, step, secondary }
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

  it('blocks reparenting or deleting a step once history exists', async () => {
    const { sequenceStepService, step, secondary } = await createGraphWithHistory()

    await expect(
      sequenceStepService.update(ctx, step.id, {
        sequenceId: secondary.id,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'id',
    })

    await expect(sequenceStepService.delete(ctx, step.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'id',
    })
  })
})
