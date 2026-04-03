/**
 * Parity Matrix Tests
 *
 * Verifies that the same SDK call through both transport modes produces
 * equivalent record shapes and raw envelopes. Uses mock transports to
 * assert correct method, path, body, and response unwrapping for every
 * resource and workflow method.
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
// 1. Base CRUD — data unwrapping vs raw envelope
// ---------------------------------------------------------------------------

describe('SDK parity matrix — CRUD unwrapping', () => {
  it('contacts.create returns record (data), not envelope', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.create({ name: 'Jane' })
    expect(result).toEqual({ id: 'test_01' })
  })

  it('contacts.get returns record (data), not envelope', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.get('contact_01')
    expect(result).toEqual({ id: 'test_01' })
  })

  it('contacts.update returns record (data), not envelope', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.update('contact_01', { name: 'Updated' })
    expect(result).toEqual({ id: 'test_01' })
  })

  it('contacts.delete returns { id, deleted } (data), not envelope', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.delete('contact_01')
    expect(result).toEqual({ id: 'test_01' })
  })
})

// ---------------------------------------------------------------------------
// 2. .response() helper — raw envelope access
// ---------------------------------------------------------------------------

describe('SDK parity matrix — .response() raw envelope', () => {
  it('.response().get returns raw envelope with meta', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.response().get('contact_01')
    expect(result.meta).toBeDefined()
    expect(result.meta.request_id).toBe('req_test')
  })

  it('.response() preserves server-owned meta, links, request_id', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.response().get('x')
    expect(result.meta.version).toBe('2026-04-01')
    expect(result.links.self).toBe('/test')
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('.response().create uses rawRequest, not request', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.response().create({ name: 'Test' })
    expect(transport.rawRequest).toHaveBeenCalledTimes(1)
  })

  it('.response().update uses rawRequest', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.response().update('id_01', { name: 'New' })
    expect(transport.rawRequest).toHaveBeenCalledTimes(1)
  })

  it('.response().delete uses rawRequest', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.response().delete('id_01')
    expect(transport.rawRequest).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 3. Pagination — cursor metadata preservation
// ---------------------------------------------------------------------------

describe('SDK parity matrix — pagination', () => {
  it('list().firstPage() preserves cursor metadata', async () => {
    const transport = createMockTransport()
    ;(transport.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: '1' }],
      meta: { request_id: 'req_01', cursor: null, next_cursor: 'abc', has_more: true, version: '2026-04-01' },
      links: { self: '/v1/contacts' },
    })
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const page = await contacts.list().firstPage()
    expect(page.meta.next_cursor).toBe('abc')
    expect(page.meta.has_more).toBe(true)
  })

  it('list() returns an AutoPager with firstPage and autoPaginate', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const pager = contacts.list()
    expect(pager.firstPage).toBeTypeOf('function')
    expect(pager.autoPaginate).toBeTypeOf('function')
  })
})

// ---------------------------------------------------------------------------
// 4. Wave 1 — correct transport paths
// ---------------------------------------------------------------------------

describe('SDK parity matrix — Wave 1 paths', () => {
  it('contacts.create calls POST /v1/contacts', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.create({ name: 'Test' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/contacts', body: { name: 'Test' },
    })
  })

  it('contacts.get calls GET /v1/contacts/:id', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.get('c_01')
    expect(transport.calls).toContainEqual({
      method: 'GET', path: '/v1/contacts/c_01', body: undefined,
    })
  })

  it('contacts.update calls PATCH /v1/contacts/:id', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.update('c_01', { name: 'New' })
    expect(transport.calls).toContainEqual({
      method: 'PATCH', path: '/v1/contacts/c_01', body: { name: 'New' },
    })
  })

  it('contacts.delete calls DELETE /v1/contacts/:id', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.delete('c_01')
    expect(transport.calls).toContainEqual({
      method: 'DELETE', path: '/v1/contacts/c_01', body: undefined,
    })
  })

  it('contacts.context calls GET /v1/context/:idOrEmail', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await contacts.context('ada@example.com')
    expect(transport.calls).toContainEqual({
      method: 'GET', path: '/v1/context/ada@example.com', body: undefined,
    })
  })

  it('deals.move calls POST /v1/deals/:id/move', async () => {
    const transport = createMockTransport()
    const { DealResource } = await import('../resources/deals.js')
    const deals = new DealResource(transport)
    await deals.move('deal_01', { stage_id: 'stage_02' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/deals/deal_01/move', body: { stage_id: 'stage_02' },
    })
  })

  it('deals.pipeline calls GET /v1/deals/pipeline', async () => {
    const transport = createMockTransport()
    const { DealResource } = await import('../resources/deals.js')
    const deals = new DealResource(transport)
    await deals.pipeline()
    expect(transport.calls).toContainEqual({
      method: 'GET', path: '/v1/deals/pipeline', body: undefined,
    })
  })

  it('deals.stats calls GET /v1/deals/stats', async () => {
    const transport = createMockTransport()
    const { DealResource } = await import('../resources/deals.js')
    const deals = new DealResource(transport)
    await deals.stats()
    expect(transport.calls).toContainEqual({
      method: 'GET', path: '/v1/deals/stats', body: undefined,
    })
  })
})

// ---------------------------------------------------------------------------
// 5. Wave 2 — workflow methods and correct paths
// ---------------------------------------------------------------------------

describe('SDK parity matrix — Wave 2 workflow paths', () => {
  it('sequences.enroll calls POST /v1/sequences/:id/enroll', async () => {
    const transport = createMockTransport()
    const { SequenceResource } = await import('../resources/sequences.js')
    const sequences = new SequenceResource(transport)
    await sequences.enroll('seq_01', { contact_id: 'c_01' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/sequences/seq_01/enroll', body: { contact_id: 'c_01' },
    })
  })

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

  it('activities.log calls POST /v1/activities/log', async () => {
    const transport = createMockTransport()
    const { ActivityResource } = await import('../resources/activities.js')
    const activities = new ActivityResource(transport)
    await activities.log({ type: 'email', contact_id: 'c_01' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/activities/log', body: { type: 'email', contact_id: 'c_01' },
    })
  })

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
    await schema.addField('contacts', { name: 'priority', type: 'string' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/objects/contacts/fields', body: { name: 'priority', type: 'string' },
    })
  })

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

  it('imports.create calls POST /v1/imports', async () => {
    const transport = createMockTransport()
    const { ImportResource } = await import('../resources/imports.js')
    const imports = new ImportResource(transport)
    await imports.create({ file: 'contacts.csv', entity: 'contacts' })
    expect(transport.calls).toContainEqual({
      method: 'POST', path: '/v1/imports', body: { file: 'contacts.csv', entity: 'contacts' },
    })
  })
})

// ---------------------------------------------------------------------------
// 6. Read-only resource — sequence_events
// ---------------------------------------------------------------------------

describe('SDK parity matrix — read-only resources', () => {
  it('sequence_events.get calls GET /v1/sequence_events/:id', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    await events.get('evt_01')
    expect(transport.calls).toContainEqual({
      method: 'GET', path: '/v1/sequence_events/evt_01', body: undefined,
    })
  })

  it('sequence_events.list returns AutoPager', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    const pager = events.list()
    expect(pager.firstPage).toBeTypeOf('function')
    expect(pager.autoPaginate).toBeTypeOf('function')
  })

  it('sequence_events has no create/update/delete methods', async () => {
    const transport = createMockTransport()
    const { SequenceEventResource } = await import('../resources/sequence-events.js')
    const events = new SequenceEventResource(transport)
    expect((events as any).create).toBeUndefined()
    expect((events as any).update).toBeUndefined()
    expect((events as any).delete).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 7. Error handling consistency
// ---------------------------------------------------------------------------

describe('SDK parity matrix — error handling', () => {
  it('OrbitApiError is thrown for error responses', async () => {
    const transport = createMockTransport()
    const { OrbitApiError } = await import('../errors.js')
    ;(transport.request as ReturnType<typeof vi.fn>).mockRejectedValue(
      new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: 'Not found' }, 404),
    )
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    await expect(contacts.get('bad')).rejects.toBeInstanceOf(OrbitApiError)
  })

  it('OrbitApiError preserves status and code', async () => {
    const transport = createMockTransport()
    const { OrbitApiError } = await import('../errors.js')
    const err = new OrbitApiError({ code: 'VALIDATION_FAILED', message: 'Invalid' }, 400)
    ;(transport.request as ReturnType<typeof vi.fn>).mockRejectedValue(err)
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    try {
      await contacts.create({ name: '' })
    } catch (e) {
      expect(e).toBeInstanceOf(OrbitApiError)
      expect((e as OrbitApiError).status).toBe(400)
      expect((e as OrbitApiError).error.code).toBe('VALIDATION_FAILED')
    }
  })
})

// ---------------------------------------------------------------------------
// 8. Cross-resource .response() parity
// ---------------------------------------------------------------------------

describe('SDK parity matrix — .response() on workflow methods', () => {
  it('deals.response().move uses rawRequest', async () => {
    const transport = createMockTransport()
    const { DealResource } = await import('../resources/deals.js')
    const deals = new DealResource(transport)
    const result = await deals.response().move('d_01', { stage_id: 's_02' })
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('sequences.response().enroll uses rawRequest', async () => {
    const transport = createMockTransport()
    const { SequenceResource } = await import('../resources/sequences.js')
    const sequences = new SequenceResource(transport)
    const result = await sequences.response().enroll('seq_01', { contact_id: 'c_01' })
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('tags.response().attach uses rawRequest', async () => {
    const transport = createMockTransport()
    const { TagResource } = await import('../resources/tags.js')
    const tags = new TagResource(transport)
    const result = await tags.response().attach('t_01', { entity_id: 'c_01', entity_type: 'contact' })
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('activities.response().log uses rawRequest', async () => {
    const transport = createMockTransport()
    const { ActivityResource } = await import('../resources/activities.js')
    const activities = new ActivityResource(transport)
    const result = await activities.response().log({ type: 'call' })
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('schema.response().listObjects uses rawRequest', async () => {
    const transport = createMockTransport()
    const { SchemaResource } = await import('../resources/schema.js')
    const schema = new SchemaResource(transport)
    const result = await schema.response().listObjects()
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('contacts.response().context uses rawRequest', async () => {
    const transport = createMockTransport()
    const { ContactResource } = await import('../resources/contacts.js')
    const contacts = new ContactResource(transport)
    const result = await contacts.response().context('ada@example.com')
    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalled()
  })
})
