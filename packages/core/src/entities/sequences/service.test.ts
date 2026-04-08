import { describe, expect, it, vi } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { generateId } from '../../ids/generate-id.js'
import { createInMemorySequenceEnrollmentRepository } from '../sequence-enrollments/repository.js'
import { createInMemorySequenceStepRepository } from '../sequence-steps/repository.js'
import type { SequenceRepository } from './repository.js'
import { createInMemorySequenceRepository } from './repository.js'
import { createSequenceService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('sequence service', () => {
  it('creates draft sequences and searches them by workflow text', async () => {
    const sequenceService = createSequenceService({
      sequences: createInMemorySequenceRepository(),
      sequenceSteps: createInMemorySequenceStepRepository(),
      sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
      tx: createNoopTransactionScope(),
    })

    const draft = await sequenceService.create(ctx, {
      name: 'New lead outreach',
      description: 'Email and task follow-up',
      triggerEvent: 'contact.created',
    })
    await sequenceService.create(ctx, {
      name: 'Re-engagement',
      description: 'Dormant account reactivation',
    })

    const search = await sequenceService.search(ctx, {
      query: 'follow-up',
      limit: 10,
    })

    expect(draft.status).toBe('draft')
    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.name).toBe('New lead outreach')
  })

  it('rejects duplicate sequence names inside the same organization', async () => {
    const sequenceService = createSequenceService({
      sequences: createInMemorySequenceRepository(),
      sequenceSteps: createInMemorySequenceStepRepository(),
      sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
      tx: createNoopTransactionScope(),
    })

    await sequenceService.create(ctx, {
      name: 'Expansion',
    })

    await expect(
      sequenceService.create(ctx, {
        name: 'Expansion',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'name',
    })
  })

  it('supports get, update, and delete for sequences', async () => {
    const sequenceService = createSequenceService({
      sequences: createInMemorySequenceRepository(),
      sequenceSteps: createInMemorySequenceStepRepository(),
      sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
      tx: createNoopTransactionScope(),
    })
    const sequence = await sequenceService.create(ctx, {
      name: 'Expansion',
    })

    expect(await sequenceService.get(ctx, sequence.id)).toMatchObject({
      id: sequence.id,
      name: 'Expansion',
    })

    const updated = await sequenceService.update(ctx, sequence.id, {
      status: 'active',
      triggerEvent: 'deal.won',
    })

    expect(updated.status).toBe('active')
    expect(updated.triggerEvent).toBe('deal.won')

    await sequenceService.delete(ctx, sequence.id)
    expect(await sequenceService.get(ctx, sequence.id)).toBeNull()
  })

  it('rejects updates that rename a sequence to an existing name in the same organization', async () => {
    const sequenceService = createSequenceService({
      sequences: createInMemorySequenceRepository(),
      sequenceSteps: createInMemorySequenceStepRepository(),
      sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
      tx: createNoopTransactionScope(),
    })
    const first = await sequenceService.create(ctx, {
      name: 'Expansion',
    })
    await sequenceService.create(ctx, {
      name: 'Renewal',
    })

    await expect(
      sequenceService.update(ctx, first.id, {
        name: 'Renewal',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'name',
    })
  })

  it('coerces repository unique-index errors to typed sequence name conflicts on create and update', async () => {
    const base = createInMemorySequenceRepository()
    const seed = await base.create(ctx, {
      id: generateId('sequence'),
      organizationId: ctx.orgId,
      name: 'Expansion',
      description: null,
      triggerEvent: null,
      status: 'draft',
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })
    const createError = new Error(
      'duplicate key value violates unique constraint "sequences_org_name_idx" on organization_id and name',
    )
    const updateError = new Error(
      'duplicate key value violates unique constraint "sequences_org_name_idx" on organization_id and name',
    )
    const sequences: SequenceRepository = {
      ...base,
      async create() {
        throw createError
      },
      async update() {
        throw updateError
      },
      // The service rebinds the repo to the txDb via `withDatabase` before
      // calling `create`/`update`. Without this override, the spread above
      // would be discarded (the inherited `withDatabase` returns the original
      // base repo) and the throwing overrides would never run.
      withDatabase() {
        return sequences
      },
    }
    const sequenceService = createSequenceService({
      sequences,
      sequenceSteps: createInMemorySequenceStepRepository(),
      sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
      tx: createNoopTransactionScope(),
    })

    await expect(
      sequenceService.create(ctx, {
        name: 'Race-created sequence',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'name',
    })

    await expect(
      sequenceService.update(ctx, seed.id, {
        name: 'Race-updated sequence',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'name',
    })
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemorySequenceRepository()
    const sequence = await repository.create(ctx, {
      id: generateId('sequence'),
      organizationId: ctx.orgId,
      name: 'Expansion',
      description: null,
      triggerEvent: null,
      status: 'draft',
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, sequence.id, {
        organizationId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })

  it('blocks sequence deletion when dependent graph records still exist', async () => {
    const sequences = createInMemorySequenceRepository()
    const sequenceSteps = createInMemorySequenceStepRepository([
      {
        id: generateId('sequenceStep'),
        organizationId: ctx.orgId,
        sequenceId: 'sequence_01ARYZ6S41YYYYYYYYYYYYYYYY',
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
      },
    ])
    const sequenceService = createSequenceService({
      sequences,
      sequenceSteps,
      sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
      tx: createNoopTransactionScope(),
    })
    const sequence = await sequences.create(ctx, {
      id: 'sequence_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Outbound',
      description: null,
      triggerEvent: null,
      status: 'draft',
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(sequenceService.delete(ctx, sequence.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'id',
    })
  })

  it('blocks sequence deletion when enrollments exist without any steps', async () => {
    const sequences = createInMemorySequenceRepository()
    const sequenceEnrollments = createInMemorySequenceEnrollmentRepository([
      {
        id: generateId('sequenceEnrollment'),
        organizationId: ctx.orgId,
        sequenceId: 'sequence_01ARYZ6S41YYYYYYYYYYYYYYYY',
        contactId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
        status: 'active',
        currentStepOrder: 0,
        enrolledAt: new Date('2026-04-02T12:00:00.000Z'),
        exitedAt: null,
        exitReason: null,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])
    const sequenceService = createSequenceService({
      sequences,
      sequenceSteps: createInMemorySequenceStepRepository(),
      sequenceEnrollments,
      tx: createNoopTransactionScope(),
    })
    const sequence = await sequences.create(ctx, {
      id: 'sequence_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Outbound',
      description: null,
      triggerEvent: null,
      status: 'draft',
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(sequenceService.delete(ctx, sequence.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'id',
    })
  })

  describe('transactional safety', () => {
    function createSpyTx() {
      const tx = createNoopTransactionScope()
      return {
        scope: { run: vi.fn(tx.run.bind(tx)) },
        get callCount() {
          return this.scope.run.mock.calls.length
        },
      }
    }

    it('runs create inside a single transaction.run() call', async () => {
      const spy = createSpyTx()
      const sequenceService = createSequenceService({
        sequences: createInMemorySequenceRepository(),
        sequenceSteps: createInMemorySequenceStepRepository(),
        sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
        tx: spy.scope,
      })

      await sequenceService.create(ctx, { name: 'Atomic create' })

      expect(spy.callCount).toBe(1)
      expect(spy.scope.run).toHaveBeenCalledWith(ctx, expect.any(Function))
    })

    it('runs update inside a single transaction.run() call', async () => {
      const spy = createSpyTx()
      const sequences = createInMemorySequenceRepository()
      const sequenceService = createSequenceService({
        sequences,
        sequenceSteps: createInMemorySequenceStepRepository(),
        sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
        tx: spy.scope,
      })
      const created = await sequenceService.create(ctx, { name: 'To rename' })
      expect(spy.callCount).toBe(1)

      await sequenceService.update(ctx, created.id, { name: 'Renamed' })

      expect(spy.callCount).toBe(2)
    })

    it('rebinds the sequences repository to the transaction-scoped db handle', async () => {
      // Spy on withDatabase to confirm the rebound repo is what gets used
      // inside the transaction body — not the original outer-scope repo.
      const baseRepo = createInMemorySequenceRepository()
      const reboundRepo = createInMemorySequenceRepository()
      const withDatabaseSpy = vi.fn(() => reboundRepo)
      const sequences: SequenceRepository = {
        ...baseRepo,
        withDatabase: withDatabaseSpy,
      }

      const sequenceService = createSequenceService({
        sequences,
        sequenceSteps: createInMemorySequenceStepRepository(),
        sequenceEnrollments: createInMemorySequenceEnrollmentRepository(),
        tx: createNoopTransactionScope(),
      })

      await sequenceService.create(ctx, { name: 'Rebound' })

      expect(withDatabaseSpy).toHaveBeenCalledTimes(1)
    })
  })
})
