import { describe, expect, it } from 'vitest'

import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createContactService } from '../contacts/service.js'
import { createInMemorySequenceEnrollmentRepository } from '../sequence-enrollments/repository.js'
import { createSequenceEnrollmentService } from '../sequence-enrollments/service.js'
import { createInMemorySequenceEventRepository } from './repository.js'
import { createSequenceEventService } from './service.js'
import { createInMemorySequenceStepRepository } from '../sequence-steps/repository.js'
import { createSequenceStepService } from '../sequence-steps/service.js'
import { createInMemorySequenceRepository } from '../sequences/repository.js'
import { createSequenceService } from '../sequences/service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

async function createEventGraph() {
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
  const sequence = await sequenceService.create(ctx, {
    name: 'Outbound',
  })
  const step = await sequenceStepService.create(ctx, {
    sequenceId: sequence.id,
    stepOrder: 1,
    actionType: 'email',
  })
  const enrollment = await sequenceEnrollmentService.create(ctx, {
    sequenceId: sequence.id,
    contactId: contact.id,
  })

  return { sequenceEventService, sequenceService, sequenceStepService, sequenceEnrollmentService, sequence, step, enrollment, contact }
}

describe('sequence event service', () => {
  it('appends history events and supports read/search semantics', async () => {
    const { sequenceEventService, enrollment, step } = await createEventGraph()

    const opened = await sequenceEventService.create(ctx, {
      sequenceEnrollmentId: enrollment.id,
      sequenceStepId: step.id,
      eventType: 'step.entered',
      payload: { channel: 'email' },
      occurredAt: new Date('2026-04-02T11:00:00.000Z'),
    })
    await sequenceEventService.create(ctx, {
      sequenceEnrollmentId: enrollment.id,
      eventType: 'sequence.completed',
      occurredAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const listed = await sequenceEventService.list(ctx, {
      filter: {
        sequence_enrollment_id: enrollment.id,
      },
      limit: 10,
    })
    const search = await sequenceEventService.search(ctx, {
      query: 'entered',
      limit: 10,
    })

    expect(opened.payload).toMatchObject({ channel: 'email' })
    expect(listed.data.map((record) => record.eventType)).toEqual(['sequence.completed', 'step.entered'])
    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.eventType).toBe('step.entered')
  })

  it('rejects events that reference a missing enrollment', async () => {
    const { sequenceEventService, step } = await createEventGraph()

    await expect(
      sequenceEventService.create(ctx, {
        sequenceEnrollmentId: 'seqenr_01ARYZ6S41YYYYYYYYYYYYYYYY',
        sequenceStepId: step.id,
        eventType: 'step.entered',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('rejects events whose sequenceStep belongs to a different sequence graph', async () => {
    const { sequenceEventService, sequenceService, sequenceStepService, enrollment } = await createEventGraph()
    const otherSequence = await sequenceService.create(ctx, {
      name: 'Lifecycle',
    })
    const foreignStep = await sequenceStepService.create(ctx, {
      sequenceId: otherSequence.id,
      stepOrder: 1,
      actionType: 'task',
    })

    await expect(
      sequenceEventService.create(ctx, {
        sequenceEnrollmentId: enrollment.id,
        sequenceStepId: foreignStep.id,
        eventType: 'step.entered',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'sequenceStepId',
    })
  })
})
