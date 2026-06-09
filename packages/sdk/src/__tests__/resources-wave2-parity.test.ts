/**
 * Wave 2 Resource Parity Tests
 *
 * Verifies all Wave 2 resources produce identical transport calls and
 * correct data unwrapping through mock transports.
 */
import { describe, it, expect, vi } from 'vitest'
import type { OrbitTransport } from '../transport/index.js'

// ---------------------------------------------------------------------------
// Mock transport factory
// ---------------------------------------------------------------------------

function createMockTransport(): OrbitTransport & { calls: Array<{ method: string; path: string; body?: unknown }> } {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const envelope = (data: unknown) => ({
    data,
    meta: { request_id: 'req_test', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
    links: { self: '/test' },
  })

  return {
    calls,
    rawRequest: vi.fn(async (input) => {
      calls.push({ method: input.method, path: input.path, body: input.body })
      return envelope({ id: 'test_01' })
    }),
    request: vi.fn(async (input) => {
      calls.push({ method: input.method, path: input.path, body: input.body })
      return envelope({ id: 'test_01' })
    }),
  }
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — activities', () => {
  it('activities.create returns data, not envelope', async () => {
    const transport = createMockTransport()
    const { ActivityResource } = await import('../resources/activities.js')
    const activities = new ActivityResource(transport)
    const result = await activities.create({ type: 'email', contact_id: 'c_01' })
    expect(result).toEqual({ id: 'test_01' })
  })

  it('activities.log calls POST /v1/activities/log', async () => {
    const transport = createMockTransport()
    const { ActivityResource } = await import('../resources/activities.js')
    const activities = new ActivityResource(transport)
    await activities.log({ type: 'call', duration: 120 })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/activities/log', body: { type: 'call', duration: 120 },
    })
  })

  it('activities.response().log returns envelope with meta', async () => {
    const transport = createMockTransport()
    const { ActivityResource } = await import('../resources/activities.js')
    const activities = new ActivityResource(transport)
    const result = await activities.response().log({ type: 'meeting' })
    expect(result.meta.request_id).toBe('req_test')
    expect(transport.rawRequest).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — sequences', () => {
  it('sequences.enroll calls POST /v1/sequences/:id/enroll', async () => {
    const transport = createMockTransport()
    const { SequenceResource } = await import('../resources/sequences.js')
    const sequences = new SequenceResource(transport)
    await sequences.enroll('seq_01', { contact_id: 'c_01' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/sequences/seq_01/enroll', body: { contact_id: 'c_01' },
    })
  })

  it('sequences.create calls POST /v1/sequences', async () => {
    const transport = createMockTransport()
    const { SequenceResource } = await import('../resources/sequences.js')
    const sequences = new SequenceResource(transport)
    await sequences.create({ name: 'Onboarding' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/sequences', body: { name: 'Onboarding' },
    })
  })

  it('sequences.response().enroll returns envelope', async () => {
    const transport = createMockTransport()
    const { SequenceResource } = await import('../resources/sequences.js')
    const sequences = new SequenceResource(transport)
    const result = await sequences.response().enroll('seq_01', { contact_id: 'c_01' })
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — tags', () => {
  it('tags.attach calls POST /v1/tags/:id/attach', async () => {
    const transport = createMockTransport()
    const { TagResource } = await import('../resources/tags.js')
    const tags = new TagResource(transport)
    await tags.attach('tag_01', { entity_id: 'c_01', entity_type: 'contact' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/tags/tag_01/attach', body: { entity_id: 'c_01', entity_type: 'contact' },
    })
  })

  it('tags.detach calls POST /v1/tags/:id/detach', async () => {
    const transport = createMockTransport()
    const { TagResource } = await import('../resources/tags.js')
    const tags = new TagResource(transport)
    await tags.detach('tag_01', { entity_id: 'c_01', entity_type: 'contact' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/tags/tag_01/detach', body: { entity_id: 'c_01', entity_type: 'contact' },
    })
  })

  it('tags.response().attach returns envelope', async () => {
    const transport = createMockTransport()
    const { TagResource } = await import('../resources/tags.js')
    const tags = new TagResource(transport)
    const result = await tags.response().attach('tag_01', { entity_id: 'c_01', entity_type: 'contact' })
    expect(result.meta.request_id).toBe('req_test')
    expect(transport.rawRequest).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — schema', () => {
  it('schema.listObjects calls GET /v1/objects', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    await schema.listObjects()
    expect(transport.calls).toContainEqual({ method: 'GET', path: '/v1/objects', body: undefined })
  })

  it('schema.describeObject calls GET /v1/objects/:type', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    await schema.describeObject('contacts')
    expect(transport.calls).toContainEqual({ method: 'GET', path: '/v1/objects/contacts', body: undefined })
  })

  it('schema.addField calls POST /v1/objects/:type/fields', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    await schema.addField('contacts', { name: 'priority', type: 'integer' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/objects/contacts/fields', body: { name: 'priority', type: 'integer' },
    })
  })

  it('schema.deleteField forwards confirmation bodies', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    const body = {
      confirmation: {
        destructive: true,
        checksum: 'a'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    }
    await schema.deleteField('contacts', 'priority', body)
    expect(transport.calls).toContainEqual({
      method: 'DELETE', path: '/v1/objects/contacts/fields/priority', body,
    })
  })

  it('schema.previewMigration calls POST /v1/schema/migrations/preview', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    await schema.previewMigration({ changes: [] })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/schema/migrations/preview', body: { changes: [] },
    })
  })

  it('schema.rollbackMigration forwards checksum confirmation bodies', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    const body = {
      checksum: 'b'.repeat(64),
      confirmation: {
        destructive: true,
        checksum: 'b'.repeat(64),
        confirmedAt: '2026-04-26T12:00:00.000Z',
      },
    }
    await schema.rollbackMigration('migration_01', body)
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/schema/migrations/migration_01/rollback', body,
    })
  })

  it('schema.response().listObjects returns envelope', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    const result = await schema.response().listObjects()
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — webhooks', () => {
  it('webhooks.deliveries returns AutoPager', async () => {
    const transport = createMockTransport()
    const { WebhookResource } = await import('../resources/webhooks.js')
    const webhooks = new WebhookResource(transport)
    const pager = webhooks.deliveries('wh_01')
    expect(pager.firstPage).toBeTypeOf('function')
    expect(pager.autoPaginate).toBeTypeOf('function')
  })

  it('webhooks.redeliver calls POST /v1/webhooks/:id/redeliver', async () => {
    const transport = createMockTransport()
    const { WebhookResource } = await import('../resources/webhooks.js')
    const webhooks = new WebhookResource(transport)
    await webhooks.redeliver('wh_01')
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/webhooks/wh_01/redeliver', body: undefined,
    })
  })

  it('webhooks.create calls POST /v1/webhooks', async () => {
    const transport = createMockTransport()
    const { WebhookResource } = await import('../resources/webhooks.js')
    const webhooks = new WebhookResource(transport)
    await webhooks.create({ url: 'https://example.com/hook', events: ['contact.created'] })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/webhooks',
      body: { url: 'https://example.com/hook', events: ['contact.created'] },
    })
  })
})

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — imports', () => {
  it('imports.create calls POST /v1/imports', async () => {
    const transport = createMockTransport()
    const { ImportResource } = await import('../resources/imports.js')
    const imports = new ImportResource(transport)
    await imports.create({ file: 'data.csv', entity: 'contacts' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/imports', body: { file: 'data.csv', entity: 'contacts' },
    })
  })

  it('imports.get calls GET /v1/imports/:id', async () => {
    const transport = createMockTransport()
    const { ImportResource } = await import('../resources/imports.js')
    const imports = new ImportResource(transport)
    await imports.get('imp_01')
    expect(transport.calls).toContainEqual({
      method: 'GET', path: '/v1/imports/imp_01', body: undefined,
    })
  })

  it('imports.pages() returns AutoPager', async () => {
    const transport = createMockTransport()
    const { ImportResource } = await import('../resources/imports.js')
    const imports = new ImportResource(transport)
    const pager = imports.pages()
    expect(pager.firstPage).toBeTypeOf('function')
    expect(pager.autoPaginate).toBeTypeOf('function')
  })
})

// ---------------------------------------------------------------------------
// Sequence Events (read-only)
// ---------------------------------------------------------------------------

describe('SDK Wave 2 parity — sequence_events (read-only)', () => {
  it('sequence_events.get returns data, not envelope', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    const result = await events.get('evt_01')
    expect(result).toEqual({ id: 'test_01' })
  })

  it('sequence_events.pages() returns AutoPager', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    const pager = events.pages()
    expect(pager.firstPage).toBeTypeOf('function')
    expect(pager.autoPaginate).toBeTypeOf('function')
  })

  it('sequence_events is read-only — no create, update, delete', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    expect((events as any).create).toBeUndefined()
    expect((events as any).update).toBeUndefined()
    expect((events as any).delete).toBeUndefined()
  })

  it('sequence_events.response().get uses rawRequest', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    const result = await events.response().get('evt_01')
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('sequence_events.response().list uses rawRequest', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    const result = await events.response().list({ limit: 10 })
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/v1/sequence_events' }),
    )
  })
})
