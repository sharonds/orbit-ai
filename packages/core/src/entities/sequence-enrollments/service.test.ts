import { describe, expect, it, vi } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { generateId } from '../../ids/generate-id.js'
import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createContactService } from '../contacts/service.js'
import type { SequenceEnrollmentRepository } from './repository.js'
import { createInMemorySequenceEnrollmentRepository } from './repository.js'
import { createSequenceEnrollmentService } from './service.js'
import { createInMemorySequenceEventRepository } from '../sequence-events/repository.js'
import { createSequenceEventService } from '../sequence-events/service.js'
import { createInMemorySequenceStepRepository } from '../sequence-steps/repository.js'
import { createSequenceStepService } from '../sequence-steps/service.js'
import { createInMemorySequenceRepository } from '../sequences/repository.js'
import { createSequenceService } from '../sequences/service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const otherCtx = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

async function createEnrollmentGraph() {
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
  const sequenceStepService = createSequenceStepService({
    sequenceSteps,
    sequences,
    sequenceEvents,
    tx: createNoopTransactionScope(),
  })
  const sequenceEnrollmentService = createSequenceEnrollmentService({
    sequenceEnrollments,
    sequences,
    contacts,
    sequenceEvents,
    tx: createNoopTransactionScope(),
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

  return {
    contact,
    sequence,
    sequenceEnrollmentService,
    sequenceEnrollments,
    sequences,
    contacts,
    sequenceEvents,
    sequenceStepService,
    sequenceEventService,
  }
}

describe('sequence enrollment service', () => {
  it('creates enrollments linked to a sequence and contact', async () => {
    const { contact, sequence, sequenceEnrollmentService } = await createEnrollmentGraph()

    const enrollment = await sequenceEnrollmentService.create(ctx, {
      sequenceId: sequence.id,
      contactId: contact.id,
    })

    expect(enrollment.status).toBe('active')
    expect(enrollment.currentStepOrder).toBe(0)
  })

  it('rejects enrollments with out-of-scope linked records', async () => {
    const { sequenceEnrollmentService, sequence } = await createEnrollmentGraph()

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: sequence.id,
        contactId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: 'sequence_01ARYZ6S41YYYYYYYYYYYYYYYY',
        contactId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('preserves uniqueness on sequence, contact, and status while allowing a different status shape', async () => {
    const { contact, sequence, sequenceEnrollmentService } = await createEnrollmentGraph()

    await sequenceEnrollmentService.create(ctx, {
      sequenceId: sequence.id,
      contactId: contact.id,
      status: 'active',
    })

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: sequence.id,
        contactId: contact.id,
        status: 'active',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'status',
    })

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: sequence.id,
        contactId: contact.id,
        status: 'paused',
      }),
    ).resolves.toMatchObject({
      status: 'paused',
    })
  })

  it('validates exit state on enrollment records', async () => {
    const { contact, sequence, sequenceEnrollmentService } = await createEnrollmentGraph()

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: sequence.id,
        contactId: contact.id,
        status: 'active',
        exitedAt: new Date('2026-04-02T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'exitedAt',
    })

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: sequence.id,
        contactId: contact.id,
        status: 'exited',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'exitedAt',
    })

    await expect(
      sequenceEnrollmentService.create(ctx, {
        sequenceId: sequence.id,
        contactId: contact.id,
        status: 'paused',
        exitReason: 'manual_stop',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'exitReason',
    })
  })

  it('supports update and delete while keeping tenant mutation blocked in the repository', async () => {
    const { contact, sequence, sequenceEnrollmentService, sequenceEnrollments } = await createEnrollmentGraph()
    const enrollment = await sequenceEnrollmentService.create(ctx, {
      sequenceId: sequence.id,
      contactId: contact.id,
    })

    await expect(
      sequenceEnrollmentService.update(ctx, enrollment.id, {
        status: 'exited',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'exitedAt',
    })

    const updated = await sequenceEnrollmentService.update(ctx, enrollment.id, {
      status: 'exited',
      currentStepOrder: 2,
      exitedAt: new Date('2026-04-02T12:10:00.000Z'),
      exitReason: 'manual_stop',
    })

    expect(updated.status).toBe('exited')
    expect(updated.currentStepOrder).toBe(2)

    await expect(
      sequenceEnrollments.update(ctx, enrollment.id, {
        organizationId: otherCtx.orgId,
      }),
    ).rejects.toThrow('Tenant record organization mismatch')

    await sequenceEnrollmentService.delete(ctx, enrollment.id)
    expect(await sequenceEnrollmentService.get(ctx, enrollment.id)).toBeNull()
  })

  it('blocks reparenting or deleting an enrollment once history exists', async () => {
    const { contact, sequence, sequenceEnrollmentService, sequenceStepService, sequenceEventService } = await createEnrollmentGraph()
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

    await expect(
      sequenceEnrollmentService.update(ctx, enrollment.id, {
        contactId: generateId('contact'),
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'id',
    })

    await expect(sequenceEnrollmentService.delete(ctx, enrollment.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'id',
    })
  })

  describe('transactional safety', () => {
    it('runs create inside a single transaction.run() call', async () => {
      const graph = await createEnrollmentGraph()
      const noop = createNoopTransactionScope()
      const runSpy = vi.fn(noop.run.bind(noop))
      const sequenceEnrollmentService = createSequenceEnrollmentService({
        sequenceEnrollments: graph.sequenceEnrollments,
        sequences: graph.sequences,
        contacts: graph.contacts,
        sequenceEvents: graph.sequenceEvents,
        tx: { run: runSpy },
      })

      await sequenceEnrollmentService.create(ctx, {
        sequenceId: graph.sequence.id,
        contactId: graph.contact.id,
      })

      expect(runSpy).toHaveBeenCalledTimes(1)
      expect(runSpy).toHaveBeenCalledWith(ctx, expect.any(Function))
    })

    it('coerces a repository unique-index error into a typed CONFLICT', async () => {
      const graph = await createEnrollmentGraph()
      const indexError = new Error(
        'duplicate key value violates unique constraint "sequence_enrollments_active_idx" on sequence_id, contact_id and status',
      )
      const enrollments: SequenceEnrollmentRepository = {
        ...graph.sequenceEnrollments,
        async create() {
          throw indexError
        },
        withDatabase() {
          return enrollments
        },
      }
      const sequenceEnrollmentService = createSequenceEnrollmentService({
        sequenceEnrollments: enrollments,
        sequences: graph.sequences,
        contacts: graph.contacts,
        sequenceEvents: graph.sequenceEvents,
        tx: createNoopTransactionScope(),
      })

      await expect(
        sequenceEnrollmentService.create(ctx, {
          sequenceId: graph.sequence.id,
          contactId: graph.contact.id,
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        field: 'status',
      })
    })
  })
})
