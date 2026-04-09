import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpTransport } from '../transport/http-transport.js'
import { OrbitApiError } from '../errors.js'
import type { OrbitClientOptions } from '../config.js'

function makeOptions(overrides: Partial<OrbitClientOptions> = {}): OrbitClientOptions {
  return {
    apiKey: 'sk_test_abc123',
    baseUrl: 'http://localhost:3000',
    version: '2026-04-01',
    maxRetries: 0,
    ...overrides,
  }
}

describe('HttpTransport', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('sends Authorization: Bearer header', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { id: 'cid_1' },
          meta: { request_id: 'req_1', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
          links: { self: '/contacts/cid_1' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const transport = new HttpTransport(makeOptions())
    await transport.request({ method: 'GET', path: '/contacts/cid_1' })

    const [, init] = fetchSpy.mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers['authorization']).toBe('Bearer sk_test_abc123')
  })

  it('sends orbit-version header', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {},
          meta: { request_id: 'req_1', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
          links: { self: '/' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const transport = new HttpTransport(makeOptions({ version: '2026-04-01' }))
    await transport.request({ method: 'GET', path: '/health' })

    const [, init] = fetchSpy.mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers['orbit-version']).toBe('2026-04-01')
  })

  it('sends idempotency-key for POST but not GET', async () => {
    const envelope = {
      data: {},
      meta: { request_id: 'req_1', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
      links: { self: '/' },
    }

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } }),
    )

    const transport = new HttpTransport(makeOptions())
    await transport.request({ method: 'GET', path: '/contacts' })

    const [, getInit] = fetchSpy.mock.calls[0]!
    const getHeaders = getInit?.headers as Record<string, string>
    expect(getHeaders['idempotency-key']).toBeUndefined()

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } }),
    )

    await transport.request({ method: 'POST', path: '/contacts', body: { name: 'Test' } })

    const [, postInit] = fetchSpy.mock.calls[1]!
    const postHeaders = postInit?.headers as Record<string, string>
    expect(postHeaders['idempotency-key']).toBeDefined()
    expect(typeof postHeaders['idempotency-key']).toBe('string')
  })

  it('throws OrbitApiError on error response', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Contact not found',
          },
        }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      ),
    )

    const transport = new HttpTransport(makeOptions())
    const err = await transport.request({ method: 'GET', path: '/contacts/nonexistent' }).catch((e) => e)

    expect(err).toBeInstanceOf(OrbitApiError)
    expect((err as OrbitApiError).status).toBe(404)
    expect((err as OrbitApiError).error.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('appends query parameters to URL', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [],
          meta: { request_id: 'req_1', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
          links: { self: '/contacts' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const transport = new HttpTransport(makeOptions())
    await transport.request({ method: 'GET', path: '/contacts', query: { limit: 10, cursor: 'abc' } })

    const [url] = fetchSpy.mock.calls[0]!
    const parsedUrl = url instanceof URL ? url : new URL(url as string)
    expect(parsedUrl.searchParams.get('limit')).toBe('10')
    expect(parsedUrl.searchParams.get('cursor')).toBe('abc')
  })

  it('uses default baseUrl when none provided', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {},
          meta: { request_id: 'req_1', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
          links: { self: '/' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const transport = new HttpTransport(makeOptions({ baseUrl: undefined }))
    await transport.request({ method: 'GET', path: '/health' })

    const [url] = fetchSpy.mock.calls[0]!
    const parsedUrl = url instanceof URL ? url : new URL(url as string)
    expect(parsedUrl.origin).toBe('http://localhost:3000')
  })
})
