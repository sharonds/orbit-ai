import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitTransport, TransportRequest } from '../transport/index.js'
import { ContactResource } from '../resources/contacts.js'
import { CompanyResource } from '../resources/companies.js'
import { DealResource } from '../resources/deals.js'
import { PipelineResource } from '../resources/pipelines.js'
import { StageResource } from '../resources/stages.js'
import { UserResource } from '../resources/users.js'
import { SearchResource } from '../search.js'
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
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_CONTACT = {
  id: 'cnt_123',
  object: 'contact' as const,
  organization_id: 'org_1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  title: null,
  source_channel: null,
  status: 'active',
  company_id: null,
  assigned_to_user_id: null,
  lead_score: 0,
  is_hot: false,
  custom_fields: {},
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const SAMPLE_DEAL = {
  id: 'deal_123',
  object: 'deal' as const,
  organization_id: 'org_1',
  name: 'Big Deal',
  value: 50000,
  currency: 'EUR',
  stage_id: 'stg_1',
  pipeline_id: 'pip_1',
  contact_id: 'cnt_123',
  company_id: null,
  assigned_to_user_id: null,
  expected_close_date: null,
  status: 'open',
  custom_fields: {},
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// ContactResource
// ---------------------------------------------------------------------------

describe('ContactResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let contacts: ContactResource

  beforeEach(() => {
    transport = createMockTransport()
    contacts = new ContactResource(transport)
  })

  it('create() returns record (not envelope) and calls transport with correct path', async () => {
    transport.request.mockResolvedValue(makeEnvelope(SAMPLE_CONTACT))

    const result = await contacts.create({ name: 'Ada Lovelace', email: 'ada@example.com' })

    expect(result).toEqual(SAMPLE_CONTACT)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/contacts',
      body: { name: 'Ada Lovelace', email: 'ada@example.com' },
    })
  })

  it('get() returns record', async () => {
    transport.request.mockResolvedValue(makeEnvelope(SAMPLE_CONTACT))

    const result = await contacts.get('cnt_123')

    expect(result).toEqual(SAMPLE_CONTACT)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/contacts/cnt_123',
    })
  })

  it('get() passes include as comma-separated query', async () => {
    transport.request.mockResolvedValue(makeEnvelope(SAMPLE_CONTACT))

    await contacts.get('cnt_123', ['company', 'deals'])

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/contacts/cnt_123',
      query: { include: 'company,deals' },
    })
  })

  it('update() calls PATCH with correct path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ ...SAMPLE_CONTACT, name: 'Updated' }))

    const result = await contacts.update('cnt_123', { name: 'Updated' })

    expect(result.name).toBe('Updated')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/contacts/cnt_123',
      body: { name: 'Updated' },
    })
  })

  it('delete() calls DELETE with correct path', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ id: 'cnt_123', deleted: true }))

    const result = await contacts.delete('cnt_123')

    expect(result).toEqual({ id: 'cnt_123', deleted: true })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/v1/contacts/cnt_123',
    })
  })

  it('response().get() returns raw envelope with meta', async () => {
    const envelope = makeEnvelope(SAMPLE_CONTACT)
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await contacts.response().get('cnt_123')

    expect(result.data).toEqual(SAMPLE_CONTACT)
    expect(result.meta).toBeDefined()
    expect(result.meta.request_id).toBe('req_test')
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/contacts/cnt_123',
    })
  })

  it('pages() returns AutoPager with firstPage and autoPaginate', async () => {
    const pager = contacts.pages({ limit: 10 })

    expect(pager).toBeDefined()
    expect(typeof pager.firstPage).toBe('function')
    expect(typeof pager.autoPaginate).toBe('function')
  })

  it('await list() returns the first page envelope directly', async () => {
    transport.request.mockResolvedValue(makeEnvelope([SAMPLE_CONTACT]))

    const page = await contacts.list({ limit: 10 })

    expect(page.data).toEqual([SAMPLE_CONTACT])
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/contacts',
      query: { limit: 10 },
    })
  })

  it('list() returns a Promise resolving to an envelope with .data array and .meta', async () => {
    transport.request.mockResolvedValue(makeEnvelope([SAMPLE_CONTACT]))

    const envelope = await contacts.list({ limit: 5 })

    // list() MUST be a Promise — await should resolve to the envelope directly
    expect(Array.isArray(envelope.data)).toBe(true)
    expect(envelope.data[0]).toEqual(SAMPLE_CONTACT)
    expect(envelope.meta).toBeDefined()
    expect(envelope.meta.has_more).toBe(false)
    expect(envelope.links.self).toBeDefined()
  })

  it('pages() returns an AutoPager instance (not a Promise)', () => {
    const pager = contacts.pages({ limit: 5 })
    // AutoPager has firstPage and autoPaginate — it is NOT a Promise
    expect(typeof pager.firstPage).toBe('function')
    expect(typeof pager.autoPaginate).toBe('function')
    expect(typeof (pager as unknown as { then?: unknown }).then).toBe('undefined')
  })

  it('for-await on pages().autoPaginate() iterates all records', async () => {
    transport.request.mockResolvedValue(makeEnvelope([SAMPLE_CONTACT]))

    const collected: unknown[] = []
    for await (const row of contacts.pages({ limit: 1 }).autoPaginate()) {
      collected.push(row)
    }
    expect(collected).toHaveLength(1)
    expect(collected[0]).toEqual(SAMPLE_CONTACT)
  })

  it('search() calls POST /v1/contacts/search', async () => {
    transport.request.mockResolvedValue(makeEnvelope([SAMPLE_CONTACT]))

    const result = await contacts.search({ query: 'Ada' })

    expect(result).toEqual([SAMPLE_CONTACT])
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/contacts/search',
      body: { query: 'Ada' },
    })
  })

  it('batch() calls POST /v1/contacts/batch', async () => {
    const batchResult = { created: 2, errors: [] }
    transport.request.mockResolvedValue(makeEnvelope(batchResult))

    const result = await contacts.batch({ create: [{ name: 'A' }, { name: 'B' }] })

    expect(result).toEqual(batchResult)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/contacts/batch',
      body: { create: [{ name: 'A' }, { name: 'B' }] },
    })
  })

  it('context() calls GET /v1/context/:idOrEmail', async () => {
    const contextData = { contact: SAMPLE_CONTACT, activities: [] }
    transport.request.mockResolvedValue(makeEnvelope(contextData))

    const result = await contacts.context('cnt_123')

    expect(result).toEqual(contextData)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/context/cnt_123',
    })
  })

  it('context() works with email', async () => {
    transport.request.mockResolvedValue(makeEnvelope({ contact: SAMPLE_CONTACT }))

    await contacts.context('ada@example.com')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/context/ada@example.com',
    })
  })
})

// ---------------------------------------------------------------------------
// DealResource
// ---------------------------------------------------------------------------

describe('DealResource', () => {
  let transport: ReturnType<typeof createMockTransport>
  let deals: DealResource

  beforeEach(() => {
    transport = createMockTransport()
    deals = new DealResource(transport)
  })

  it('move() calls POST /v1/deals/:id/move', async () => {
    const movedDeal = { ...SAMPLE_DEAL, stage_id: 'stg_2' }
    transport.request.mockResolvedValue(makeEnvelope(movedDeal))

    const result = await deals.move('deal_123', { stage_id: 'stg_2' })

    expect(result.stage_id).toBe('stg_2')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/deals/deal_123/move',
      body: { stage_id: 'stg_2' },
    })
  })

  it('pipeline() calls GET /v1/deals/pipeline', async () => {
    const pipelineData = { stages: [] }
    transport.request.mockResolvedValue(makeEnvelope(pipelineData))

    const result = await deals.pipeline()

    expect(result).toEqual(pipelineData)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/deals/pipeline',
    })
  })

  it('stats() calls GET /v1/deals/stats', async () => {
    const statsData = { total_value: 100000, count: 5 }
    transport.request.mockResolvedValue(makeEnvelope(statsData))

    const result = await deals.stats()

    expect(result).toEqual(statsData)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/deals/stats',
    })
  })

  it('response().move() returns raw envelope', async () => {
    const envelope = makeEnvelope(SAMPLE_DEAL)
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await deals.response().move('deal_123', { stage_id: 'stg_2' })

    expect(result.meta).toBeDefined()
    expect(transport.rawRequest).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/deals/deal_123/move',
      body: { stage_id: 'stg_2' },
    })
  })

  it('create() works via base class', async () => {
    transport.request.mockResolvedValue(makeEnvelope(SAMPLE_DEAL))

    const result = await deals.create({ name: 'Big Deal', value: 50000 })

    expect(result).toEqual(SAMPLE_DEAL)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/deals',
      body: { name: 'Big Deal', value: 50000 },
    })
  })
})

// ---------------------------------------------------------------------------
// CompanyResource — basic sanity
// ---------------------------------------------------------------------------

describe('CompanyResource', () => {
  it('uses /v1/companies path', async () => {
    const transport = createMockTransport()
    const companies = new CompanyResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'cmp_1' }))

    await companies.get('cmp_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/companies/cmp_1',
    })
  })
})

// ---------------------------------------------------------------------------
// PipelineResource — basic sanity
// ---------------------------------------------------------------------------

describe('PipelineResource', () => {
  it('uses /v1/pipelines path', async () => {
    const transport = createMockTransport()
    const pipelines = new PipelineResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'pip_1' }))

    await pipelines.get('pip_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/pipelines/pip_1',
    })
  })
})

// ---------------------------------------------------------------------------
// StageResource — basic sanity
// ---------------------------------------------------------------------------

describe('StageResource', () => {
  it('uses /v1/stages path', async () => {
    const transport = createMockTransport()
    const stages = new StageResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'stg_1' }))

    await stages.get('stg_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/stages/stg_1',
    })
  })
})

// ---------------------------------------------------------------------------
// UserResource — basic sanity
// ---------------------------------------------------------------------------

describe('UserResource', () => {
  it('uses /v1/users path', async () => {
    const transport = createMockTransport()
    const users = new UserResource(transport)
    transport.request.mockResolvedValue(makeEnvelope({ id: 'usr_1' }))

    await users.get('usr_1')

    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/users/usr_1',
    })
  })
})

// ---------------------------------------------------------------------------
// SearchResource
// ---------------------------------------------------------------------------

describe('SearchResource', () => {
  it('query() calls POST /v1/search', async () => {
    const transport = createMockTransport()
    const search = new SearchResource(transport)
    const searchResults = [{ id: 'cnt_1', type: 'contact' }]
    transport.request.mockResolvedValue(makeEnvelope(searchResults))

    const result = await search.query({ query: 'Ada', object_types: ['contact'] })

    expect(result).toEqual(searchResults)
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/search',
      body: { query: 'Ada', object_types: ['contact'] },
    })
  })

  it('response().query() returns raw envelope', async () => {
    const transport = createMockTransport()
    const search = new SearchResource(transport)
    const envelope = makeEnvelope([])
    transport.rawRequest.mockResolvedValue(envelope)

    const result = await search.response().query({ query: 'test' })

    expect(result.meta).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// OrbitClient wiring
// ---------------------------------------------------------------------------

describe('OrbitClient resource wiring', () => {
  it('exposes all Wave 1 resources', () => {
    const client = new OrbitClient({ apiKey: 'test-key' })

    expect(client.contacts).toBeInstanceOf(ContactResource)
    expect(client.companies).toBeInstanceOf(CompanyResource)
    expect(client.deals).toBeInstanceOf(DealResource)
    expect(client.pipelines).toBeInstanceOf(PipelineResource)
    expect(client.stages).toBeInstanceOf(StageResource)
    expect(client.users).toBeInstanceOf(UserResource)
    expect(client.search).toBeInstanceOf(SearchResource)
  })
})
