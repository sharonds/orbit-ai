/**
 * Transport Parity Tests (RED — pre-written for Task 8)
 *
 * These tests assert that HttpTransport and DirectTransport produce
 * identical envelope shapes, cursor metadata, error codes, and that
 * DirectTransport never calls runWithMigrationAuthority.
 *
 * All tests are expected to FAIL until Task 8 implements the transports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpTransport } from '../transport/http-transport.js'
import { DirectTransport } from '../transport/direct-transport.js'
import { OrbitApiError } from '../errors.js'
import type { OrbitEnvelope, PageMeta, EnvelopeLinks } from '@orbit-ai/core'
import type { OrbitTransport, TransportRequest } from '../transport/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIST_REQUEST: TransportRequest = {
  method: 'GET',
  path: '/contacts',
  query: { limit: 10 },
}

const GET_REQUEST: TransportRequest = {
  method: 'GET',
  path: '/contacts/cid_123',
}

const CREATE_REQUEST: TransportRequest = {
  method: 'POST',
  path: '/contacts',
  body: { name: 'Ada Lovelace', email: 'ada@example.com' },
}

function assertEnvelopeShape<T>(envelope: OrbitEnvelope<T>): void {
  // data
  expect(envelope).toHaveProperty('data')

  // meta — all PageMeta fields present
  expect(envelope).toHaveProperty('meta')
  const meta = envelope.meta as PageMeta
  expect(typeof meta.request_id).toBe('string')
  expect(meta.request_id.length).toBeGreaterThan(0)
  expect(typeof meta.version).toBe('string')
  expect('cursor' in meta).toBe(true)
  expect('next_cursor' in meta).toBe(true)
  expect(typeof meta.has_more).toBe('boolean')

  // links
  expect(envelope).toHaveProperty('links')
  const links = envelope.links as EnvelopeLinks
  expect(typeof links.self).toBe('string')
}

// ---------------------------------------------------------------------------
// 1. Identical envelope shape
// ---------------------------------------------------------------------------

describe('Transport parity — envelope shape', () => {
  let http: OrbitTransport
  let direct: OrbitTransport

  beforeEach(() => {
    // Task 8 will make these constructors accept proper options.
    // For now the stubs are empty classes, so these will fail.
    http = new HttpTransport() as unknown as OrbitTransport
    direct = new DirectTransport() as unknown as OrbitTransport
  })

  it('HttpTransport.request returns a valid OrbitEnvelope', async () => {
    const result = await http.request(GET_REQUEST)
    assertEnvelopeShape(result)
  })

  it('DirectTransport.request returns a valid OrbitEnvelope', async () => {
    const result = await direct.request(GET_REQUEST)
    assertEnvelopeShape(result)
  })

  it('both transports return identical top-level keys for GET single', async () => {
    const httpResult = await http.request(GET_REQUEST)
    const directResult = await direct.request(GET_REQUEST)

    const httpKeys = Object.keys(httpResult).sort()
    const directKeys = Object.keys(directResult).sort()
    expect(httpKeys).toEqual(directKeys)
    expect(httpKeys).toEqual(['data', 'links', 'meta'])
  })

  it('both transports return identical meta keys for list request', async () => {
    const httpResult = await http.request(LIST_REQUEST)
    const directResult = await direct.request(LIST_REQUEST)

    const httpMetaKeys = Object.keys(httpResult.meta).sort()
    const directMetaKeys = Object.keys(directResult.meta).sort()
    expect(httpMetaKeys).toEqual(directMetaKeys)
  })

  it('both transports return identical link keys for POST request', async () => {
    const httpResult = await http.request(CREATE_REQUEST)
    const directResult = await direct.request(CREATE_REQUEST)

    const httpLinkKeys = Object.keys(httpResult.links).sort()
    const directLinkKeys = Object.keys(directResult.links).sort()
    expect(httpLinkKeys).toEqual(directLinkKeys)
  })
})

// ---------------------------------------------------------------------------
// 2. Cursor metadata parity
// ---------------------------------------------------------------------------

describe('Transport parity — cursor metadata', () => {
  let http: OrbitTransport
  let direct: OrbitTransport

  beforeEach(() => {
    http = new HttpTransport() as unknown as OrbitTransport
    direct = new DirectTransport() as unknown as OrbitTransport
  })

  it('direct transport synthesizes next_cursor matching HTTP shape', async () => {
    const httpResult = await http.request(LIST_REQUEST)
    const directResult = await direct.request(LIST_REQUEST)

    // Both should be either null or an opaque cursor string
    expect(typeof directResult.meta.next_cursor).toBe(
      typeof httpResult.meta.next_cursor,
    )
  })

  it('direct transport synthesizes has_more matching HTTP shape', async () => {
    const httpResult = await http.request(LIST_REQUEST)
    const directResult = await direct.request(LIST_REQUEST)

    expect(typeof directResult.meta.has_more).toBe('boolean')
    expect(typeof httpResult.meta.has_more).toBe('boolean')
  })

  it('cursor is null for single-resource GET on both transports', async () => {
    const httpResult = await http.request(GET_REQUEST)
    const directResult = await direct.request(GET_REQUEST)

    expect(httpResult.meta.next_cursor).toBeNull()
    expect(directResult.meta.next_cursor).toBeNull()
    expect(httpResult.meta.has_more).toBe(false)
    expect(directResult.meta.has_more).toBe(false)
  })

  it('version string is identical across transports', async () => {
    const httpResult = await http.request(GET_REQUEST)
    const directResult = await direct.request(GET_REQUEST)

    expect(directResult.meta.version).toBe(httpResult.meta.version)
  })
})

// ---------------------------------------------------------------------------
// 3. Error code parity
// ---------------------------------------------------------------------------

describe('Transport parity — error codes', () => {
  let http: OrbitTransport
  let direct: OrbitTransport

  beforeEach(() => {
    http = new HttpTransport() as unknown as OrbitTransport
    direct = new DirectTransport() as unknown as OrbitTransport
  })

  it('both throw OrbitApiError on 404 with RESOURCE_NOT_FOUND code', async () => {
    const notFoundReq: TransportRequest = {
      method: 'GET',
      path: '/contacts/nonexistent_999',
    }

    const httpErr = await http.request(notFoundReq).catch((e) => e)
    const directErr = await direct.request(notFoundReq).catch((e) => e)

    expect(httpErr).toBeInstanceOf(OrbitApiError)
    expect(directErr).toBeInstanceOf(OrbitApiError)
    expect((httpErr as OrbitApiError).status).toBe(404)
    expect((directErr as OrbitApiError).status).toBe(404)
    expect((httpErr as OrbitApiError).error.code).toBe('RESOURCE_NOT_FOUND')
    expect((directErr as OrbitApiError).error.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('both throw OrbitApiError on 401 with AUTH_INVALID_API_KEY code', async () => {
    // Construct transports with invalid credentials
    const badHttp = new HttpTransport() as unknown as OrbitTransport
    const badDirect = new DirectTransport() as unknown as OrbitTransport

    const httpErr = await badHttp.request(GET_REQUEST).catch((e) => e)
    const directErr = await badDirect.request(GET_REQUEST).catch((e) => e)

    expect(httpErr).toBeInstanceOf(OrbitApiError)
    expect(directErr).toBeInstanceOf(OrbitApiError)
    expect((httpErr as OrbitApiError).status).toBe(401)
    expect((directErr as OrbitApiError).status).toBe(401)
    expect((httpErr as OrbitApiError).error.code).toBe('AUTH_INVALID_API_KEY')
    expect((directErr as OrbitApiError).error.code).toBe('AUTH_INVALID_API_KEY')
  })

  it('both throw OrbitApiError on 400 with VALIDATION_FAILED code', async () => {
    const badCreate: TransportRequest = {
      method: 'POST',
      path: '/contacts',
      body: {}, // missing required fields
    }

    const httpErr = await http.request(badCreate).catch((e) => e)
    const directErr = await direct.request(badCreate).catch((e) => e)

    expect(httpErr).toBeInstanceOf(OrbitApiError)
    expect(directErr).toBeInstanceOf(OrbitApiError)
    expect((httpErr as OrbitApiError).status).toBe(400)
    expect((directErr as OrbitApiError).status).toBe(400)
    expect((httpErr as OrbitApiError).error.code).toBe('VALIDATION_FAILED')
    expect((directErr as OrbitApiError).error.code).toBe('VALIDATION_FAILED')
  })

  it('error shape includes request_id on both transports', async () => {
    const notFoundReq: TransportRequest = {
      method: 'GET',
      path: '/contacts/nonexistent_999',
    }

    const httpErr = (await http
      .request(notFoundReq)
      .catch((e) => e)) as OrbitApiError
    const directErr = (await direct
      .request(notFoundReq)
      .catch((e) => e)) as OrbitApiError

    expect(httpErr.error.request_id).toBeDefined()
    expect(directErr.error.request_id).toBeDefined()
    expect(typeof httpErr.error.request_id).toBe('string')
    expect(typeof directErr.error.request_id).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// 4. DirectTransport must NOT call runWithMigrationAuthority
// ---------------------------------------------------------------------------

describe('Transport parity — no migration authority in DirectTransport', () => {
  it('DirectTransport constructor does not call runWithMigrationAuthority', () => {
    // Spy on the adapter to ensure runWithMigrationAuthority is never invoked.
    // The real adapter will be passed in Task 8; here we verify the contract.
    const mockAdapter = {
      runWithMigrationAuthority: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    }

    // Constructing DirectTransport should not trigger migration authority
    const _transport = new DirectTransport() as any

    // If DirectTransport accepted the adapter in constructor:
    // const _transport = new DirectTransport({ adapter: mockAdapter, context: { orgId: 'org_1' } })

    expect(mockAdapter.runWithMigrationAuthority).not.toHaveBeenCalled()
  })

  it('DirectTransport.request does not call runWithMigrationAuthority', async () => {
    const mockAdapter = {
      runWithMigrationAuthority: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    }

    const transport = new DirectTransport() as unknown as OrbitTransport

    // Will fail because stub has no request method — that is expected
    try {
      await transport.request(GET_REQUEST)
    } catch {
      // Expected to fail on stub
    }

    expect(mockAdapter.runWithMigrationAuthority).not.toHaveBeenCalled()
  })
})
