import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'
import { ActivityResource } from '../resources/activities.js'
import { TaskResource } from '../resources/tasks.js'
import { NoteResource } from '../resources/notes.js'
import { ProductResource } from '../resources/products.js'
import { PaymentResource } from '../resources/payments.js'
import { ContractResource } from '../resources/contracts.js'
import { ImportResource } from '../resources/imports.js'
import { SequenceResource } from '../resources/sequences.js'
import { SequenceStepResource } from '../resources/sequence-steps.js'
import { SequenceEnrollmentResource } from '../resources/sequence-enrollments.js'
import { SequenceEventResource } from '../resources/sequence-events.js'
import { TagResource } from '../resources/tags.js'
import { SchemaResource } from '../resources/schema.js'
import { WebhookResource } from '../resources/webhooks.js'
import { AutoPager } from '../pagination.js'
import { OrbitClient } from '../client.js'

// ---------------------------------------------------------------------------
// Mock transport
// ---------------------------------------------------------------------------

function makeMeta() {
  return {
    request_id: 'req_test',
    cursor: null,
    next_cursor: null,
    has_more: false,
    version: '2025-04-01',
  }
}

function makeEnvelope<T>(data: T): OrbitEnvelope<T> {
  return {
    data,
    meta: makeMeta(),
    links: { self: '/test' },
  }
}

function createMockTransport(): OrbitTransport & {
  request: ReturnType<typeof vi.fn>
  rawRequest: ReturnType<typeof vi.fn>
} {
  return {
    request: vi.fn(),
    rawRequest: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Simple BaseResource extensions — correct path verification
// ---------------------------------------------------------------------------

describe('ActivityResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let activities: ActivityResource

  beforeEach(() => {
    transport = createMockTransport()
    activities = new ActivityResource(transport)
  })

  it('uses /v1/activities path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'act_1' }))
    await activities.get('act_1')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/activities/act_1',
    })
  })

  it('log() calls POST /v1/activities/log', async () => {
    const logData = { type: 'email_sent', contact_id: 'cnt_1' }
    transport.request.mockResolvedValue(makeEnvelope({ id: 'act_2', ...logData }))

    const result = await activities.log(logData)

    expect(result).toEqual({ id: 'act_2', ...logData })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/activities/log',
      body: logData,
    })
  })

  it('response().log() returns raw envelope', async () => {
    const envelope = makeEnvelope({ id: 'act_2' })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await activities.response().log({ type: 'call' })

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/activities/log',
      body: { type: 'call' },
    })
  })

  it('create() passes body, direction, and metadata through transport', async () => {
    const input = {
      type: 'email_sent',
      body: 'Hey there',
      direction: 'outbound',
      metadata: { campaign_id: 'camp_1' },
      logged_by_user_id: 'user_123',
    }
    transport.request.mockResolvedValue(makeEnvelope({ id: 'act_3', ...input }))

    await activities.create(input)

    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/activities',
      body: input,
    })
  })

  it('ActivityRecord wire format uses logged_by_user_id, not user_id', async () => {
    // Type-level check: CreateActivityInput must accept logged_by_user_id
    // and must not accept user_id (this is enforced by TypeScript, tested here
    // by verifying the transport receives the correct field name at runtime)
    const input = {
      type: 'call',
      logged_by_user_id: 'user_abc',
      occurred_at: '2026-04-10T09:00:00.000Z',
    }
    transport.request.mockResolvedValue(makeEnvelope({ id: 'act_4', ...input }))

    await activities.create(input)

    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/activities',
      body: input,
    })
  })
})

describe('TaskResource', () => {
  it('uses /v1/tasks path', async () => {
    const transport = createMockTransport()
    const tasks = new TaskResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'tsk_1' }))

    await tasks.get('tsk_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/tasks/tsk_1',
    })
  })
})

describe('NoteResource', () => {
  it('uses /v1/notes path', async () => {
    const transport = createMockTransport()
    const notes = new NoteResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'note_1' }))

    await notes.get('note_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/notes/note_1',
    })
  })
})

describe('ProductResource', () => {
  it('uses /v1/products path', async () => {
    const transport = createMockTransport()
    const products = new ProductResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'prod_1' }))

    await products.get('prod_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/products/prod_1',
    })
  })
})

describe('PaymentResource', () => {
  it('uses /v1/payments path', async () => {
    const transport = createMockTransport()
    const payments = new PaymentResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'pay_1' }))

    await payments.get('pay_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/payments/pay_1',
    })
  })

  it('create() passes external_id and metadata through transport', async () => {
    const transport = createMockTransport()
    const payments = new PaymentResource(transport)
    const input = {
      amount: 9999,
      currency: 'EUR',
      status: 'paid',
      external_id: 'stripe_ch_abc123',
      metadata: { invoice_id: 'inv_1' },
    }
    transport.request.mockResolvedValue(makeEnvelope({ id: 'pay_2', ...input }))

    await payments.create(input)

    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/payments',
      body: input,
    })
  })

  it('create() passes payment_method alias through transport', async () => {
    const transport = createMockTransport()
    const payments = new PaymentResource(transport)
    const input = {
      amount: 500,
      currency: 'USD',
      status: 'paid',
      payment_method: 'ideal',
    }
    transport.request.mockResolvedValue(makeEnvelope({ id: 'pay_3', method: 'ideal' }))

    await payments.create(input)

    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/payments',
      body: input,
    })
  })
})

describe('ContractResource', () => {
  it('uses /v1/contracts path', async () => {
    const transport = createMockTransport()
    const contracts = new ContractResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'ctr_1' }))

    await contracts.get('ctr_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/contracts/ctr_1',
    })
  })
})

describe('ImportResource', () => {
  it('uses /v1/imports path', async () => {
    const transport = createMockTransport()
    const imports = new ImportResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'imp_1' }))

    await imports.get('imp_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/imports/imp_1',
    })
  })
})

// ---------------------------------------------------------------------------
// Resources with workflow methods
// ---------------------------------------------------------------------------

describe('SequenceResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let sequences: SequenceResource

  beforeEach(() => {
    transport = createMockTransport()
    sequences = new SequenceResource(transport)
  })

  it('uses /v1/sequences path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'seq_1' }))
    await sequences.get('seq_1')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/sequences/seq_1',
    })
  })

  it('enroll() calls POST /v1/sequences/:id/enroll', async () => {
    const body = { contact_id: 'cnt_1' }
    transport.request.mockResolvedValue(makeEnvelope({ id: 'enr_1' }))

    const result = await sequences.enroll('seq_1', body)

    expect(result).toEqual({ id: 'enr_1' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/sequences/seq_1/enroll',
      body,
    })
  })

  it('response().enroll() returns raw envelope', async () => {
    const envelope = makeEnvelope({ id: 'enr_1' })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await sequences.response().enroll('seq_1', { contact_id: 'cnt_1' })

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/sequences/seq_1/enroll',
      body: { contact_id: 'cnt_1' },
    })
  })
})

describe('SequenceStepResource', () => {
  it('uses /v1/sequence_steps path', async () => {
    const transport = createMockTransport()
    const steps = new SequenceStepResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'step_1' }))

    await steps.get('step_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/sequence_steps/step_1',
    })
  })
})

describe('SequenceEnrollmentResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let enrollments: SequenceEnrollmentResource

  beforeEach(() => {
    transport = createMockTransport()
    enrollments = new SequenceEnrollmentResource(transport)
  })

  it('uses /v1/sequence_enrollments path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'enr_1' }))
    await enrollments.get('enr_1')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/sequence_enrollments/enr_1',
    })
  })

  it('unenroll() calls POST /v1/sequence_enrollments/:id/unenroll', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'enr_1', status: 'unenrolled' }))

    const result = await enrollments.unenroll('enr_1')

    expect(result).toEqual({ id: 'enr_1', status: 'unenrolled' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/sequence_enrollments/enr_1/unenroll',
    })
  })

  it('response().unenroll() returns raw envelope', async () => {
    const envelope = makeEnvelope({ id: 'enr_1' })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await enrollments.response().unenroll('enr_1')

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/sequence_enrollments/enr_1/unenroll',
    })
  })
})

describe('SequenceEventResource (read-only)', () => {
  let transport: ReturnType<typeof createMockTransport>
  let events: SequenceEventResource

  beforeEach(() => {
    transport = createMockTransport()
    events = new SequenceEventResource(transport)
  })

  it('uses /v1/sequence_events path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'evt_1' }))
    await events.get('evt_1')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/sequence_events/evt_1',
    })
  })

  it('pages() returns AutoPager', () => {
    const pager = events.pages()
    expect(pager).toBeInstanceOf(AutoPager)
  })

  it('does not expose create, update, or delete', () => {
    // SequenceEventResource is read-only — verify no mutation methods
    expect((events as any).create).toBeUndefined()
    expect((events as any).update).toBeUndefined()
    expect((events as any).delete).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// TagResource
// ---------------------------------------------------------------------------

describe('TagResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let tags: TagResource

  beforeEach(() => {
    transport = createMockTransport()
    tags = new TagResource(transport)
  })

  it('uses /v1/tags path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'tag_1' }))
    await tags.get('tag_1')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/tags/tag_1',
    })
  })

  it('attach() calls POST /v1/tags/:id/attach', async () => {
    const body = { contact_ids: ['cnt_1', 'cnt_2'] }
    transport.request.mockResolvedValue(makeEnvelope({ attached: 2 }))

    const result = await tags.attach('tag_1', body)

    expect(result).toEqual({ attached: 2 })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/tags/tag_1/attach',
      body,
    })
  })

  it('detach() calls POST /v1/tags/:id/detach', async () => {
    const body = { contact_ids: ['cnt_1'] }
    transport.request.mockResolvedValue(makeEnvelope({ detached: 1 }))

    const result = await tags.detach('tag_1', body)

    expect(result).toEqual({ detached: 1 })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/tags/tag_1/detach',
      body,
    })
  })

  it('response().attach() returns raw envelope', async () => {
    const envelope = makeEnvelope({ attached: 2 })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await tags.response().attach('tag_1', { contact_ids: ['cnt_1'] })

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/tags/tag_1/attach',
      body: { contact_ids: ['cnt_1'] },
    })
  })

  it('response().detach() returns raw envelope', async () => {
    const envelope = makeEnvelope({ detached: 1 })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await tags.response().detach('tag_1', { contact_ids: ['cnt_1'] })

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/tags/tag_1/detach',
      body: { contact_ids: ['cnt_1'] },
    })
  })
})

// ---------------------------------------------------------------------------
// SchemaResource
// ---------------------------------------------------------------------------

describe('SchemaResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let schema: SchemaResource

  beforeEach(() => {
    transport = createMockTransport()
    schema = new SchemaResource(transport)
  })

  it('listObjects() calls GET /v1/objects', async () => {
    transport.request.mockResolvedValue(makeEnvelope([{ type: 'contacts' }]))

    const result = await schema.listObjects()

    expect(result).toEqual([{ type: 'contacts' }])
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/objects',
    })
  })

  it('describeObject() calls GET /v1/objects/:type', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ type: 'contacts', fields: [] }))

    const result = await schema.describeObject('contacts')

    expect(result).toEqual({ type: 'contacts', fields: [] })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/objects/contacts',
    })
  })

  it('addField() calls POST /v1/objects/:type/fields', async () => {
    const body = { name: 'birthday', type: 'date' }
    transport.request.mockResolvedValue(makeEnvelope({ name: 'birthday' }))

    const result = await schema.addField('contacts', body)

    expect(result).toEqual({ name: 'birthday' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/objects/contacts/fields',
      body,
    })
  })

  it('updateField() calls PATCH /v1/objects/:type/fields/:fieldName', async () => {
    const body = { required: true }
    transport.request.mockResolvedValue(makeEnvelope({ name: 'birthday', required: true }))

    const result = await schema.updateField('contacts', 'birthday', body)

    expect(result).toEqual({ name: 'birthday', required: true })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/objects/contacts/fields/birthday',
      body,
    })
  })

  it('deleteField() calls DELETE /v1/objects/:type/fields/:fieldName', async () => {
    const body = {
      confirmation: {
        destructive: true,
        checksum: 'a'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    }
    transport.request.mockResolvedValue(makeEnvelope({ deleted: true }))

    const result = await schema.deleteField('contacts', 'birthday', body)

    expect(result).toEqual({ deleted: true })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/objects/contacts/fields/birthday',
      body,
    })
  })

  it('previewMigration() calls POST /v1/schema/migrations/preview', async () => {
    const body = { changes: [{ type: 'add_field' }] }
    transport.request.mockResolvedValue(makeEnvelope({ sql: 'ALTER TABLE...' }))

    const result = await schema.previewMigration(body)

    expect(result).toEqual({ sql: 'ALTER TABLE...' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/schema/migrations/preview',
      body,
    })
  })

  it('applyMigration() calls POST /v1/schema/migrations/apply', async () => {
    const body = { changes: [{ type: 'add_field' }] }
    transport.request.mockResolvedValue(makeEnvelope({ migration_id: 'mig_1' }))

    const result = await schema.applyMigration(body)

    expect(result).toEqual({ migration_id: 'mig_1' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/schema/migrations/apply',
      body,
    })
  })

  it('rollbackMigration() calls POST /v1/schema/migrations/:id/rollback', async () => {
    const body = {
      checksum: 'b'.repeat(64),
      confirmation: {
        destructive: true,
        checksum: 'b'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    }
    transport.request.mockResolvedValue(makeEnvelope({ rolled_back: true }))

    const result = await schema.rollbackMigration('mig_1', body)

    expect(result).toEqual({ rolled_back: true })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/schema/migrations/mig_1/rollback',
      body,
    })
  })

  it('response().deleteField() sends confirmation body and returns raw envelope', async () => {
    const body = {
      confirmation: {
        destructive: true,
        checksum: 'c'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    }
    const envelope = makeEnvelope({ deleted: true, field: 'birthday' })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await schema.response().deleteField('contacts', 'birthday', body)

    expect(result).toBe(envelope)
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/objects/contacts/fields/birthday',
      body,
    })
  })

  it('response().rollbackMigration() sends confirmation body and returns raw envelope', async () => {
    const body = {
      checksum: 'd'.repeat(64),
      confirmation: {
        destructive: true,
        checksum: 'd'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    }
    const envelope = makeEnvelope({ status: 'rolled_back' })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await schema.response().rollbackMigration('mig_1', body)

    expect(result).toBe(envelope)
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/schema/migrations/mig_1/rollback',
      body,
    })
  })

  it('response().listObjects() returns raw envelope', async () => {
    const envelope = makeEnvelope([])
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await schema.response().listObjects()

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/objects',
    })
  })
})

// ---------------------------------------------------------------------------
// WebhookResource
// ---------------------------------------------------------------------------

describe('WebhookResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let webhooks: WebhookResource

  beforeEach(() => {
    transport = createMockTransport()
    webhooks = new WebhookResource(transport)
  })

  it('uses /v1/webhooks path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'wh_1' }))
    await webhooks.get('wh_1')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/webhooks/wh_1',
    })
  })

  it('deliveries() returns AutoPager', () => {
    const pager = webhooks.deliveries('wh_1')
    expect(pager).toBeInstanceOf(AutoPager)
  })

  it('redeliver() calls POST /v1/webhooks/:id/redeliver', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ redelivered: true }))

    const result = await webhooks.redeliver('wh_1')

    expect(result).toEqual({ redelivered: true })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/webhooks/wh_1/redeliver',
    })
  })

  it('response().redeliver() returns raw envelope', async () => {
    const envelope = makeEnvelope({ redelivered: true })
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await webhooks.response().redeliver('wh_1')

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/webhooks/wh_1/redeliver',
    })
  })

  it('response().deliveries() returns raw envelope', async () => {
    const envelope = makeEnvelope([])
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await webhooks.response().deliveries('wh_1')

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/webhooks/wh_1/deliveries',
    })
  })
})

// ---------------------------------------------------------------------------
// OrbitClient wiring — Wave 2
// ---------------------------------------------------------------------------

describe('OrbitClient Wave 2 resource wiring', () => {
  it('exposes all Wave 2 resources', () => {
    const client = new OrbitClient({ apiKey: 'test-key' })

    expect(client.activities).toBeInstanceOf(ActivityResource)
    expect(client.tasks).toBeInstanceOf(TaskResource)
    expect(client.notes).toBeInstanceOf(NoteResource)
    expect(client.products).toBeInstanceOf(ProductResource)
    expect(client.payments).toBeInstanceOf(PaymentResource)
    expect(client.contracts).toBeInstanceOf(ContractResource)
    expect(client.sequences).toBeInstanceOf(SequenceResource)
    expect(client.sequenceSteps).toBeInstanceOf(SequenceStepResource)
    expect(client.sequenceEnrollments).toBeInstanceOf(SequenceEnrollmentResource)
    expect(client.sequenceEvents).toBeInstanceOf(SequenceEventResource)
    expect(client.tags).toBeInstanceOf(TagResource)
    expect(client.schema).toBeInstanceOf(SchemaResource)
    expect(client.webhooks).toBeInstanceOf(WebhookResource)
    expect(client.imports).toBeInstanceOf(ImportResource)
  })
})
