import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import type { OrbitEnvelope } from '@orbit-ai/core'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import {
  toEnvelope,
  toError,
  toWebhookRead,
  toWebhookDeliveryRead,
} from '../responses.js'

const DEFAULT_VERSION = '2026-04-01'

function createTestApp() {
  const app = new Hono()
  app.onError(orbitErrorHandler)
  app.use('*', requestIdMiddleware())
  app.use('*', versionMiddleware(DEFAULT_VERSION))
  return app
}

// --- toEnvelope ---

describe('toEnvelope', () => {
  it('wraps a single record with { data, meta, links }', async () => {
    const app = createTestApp()
    app.get('/v1/contacts/c_001', (c) => {
      const record = { id: 'c_001', name: 'Alice' }
      return c.json(toEnvelope(c, record))
    })

    const res = await app.request('/v1/contacts/c_001', {
      headers: { 'x-request-id': 'req_test1' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as OrbitEnvelope<{
      id: string
      name: string
    }>
    expect(body.data).toEqual({ id: 'c_001', name: 'Alice' })
    expect(body.meta.request_id).toBe('req_test1')
    expect(body.meta.version).toBe(DEFAULT_VERSION)
    expect(body.meta.has_more).toBe(false)
    expect(body.meta.next_cursor).toBeNull()
    expect(body.links.self).toBe('/v1/contacts/c_001')
  })

  it('includes pagination when InternalPaginatedResult is provided', async () => {
    const app = createTestApp()
    app.get('/v1/contacts', (c) => {
      const records = [
        { id: 'c_001' },
        { id: 'c_002' },
      ]
      const page = {
        data: records,
        nextCursor: 'cursor_abc',
        hasMore: true,
      }
      return c.json(toEnvelope(c, records, page))
    })

    const res = await app.request('/v1/contacts', {
      headers: { 'x-request-id': 'req_test2' },
    })
    const body = (await res.json()) as OrbitEnvelope<
      { id: string }[]
    >
    expect(body.meta.next_cursor).toBe('cursor_abc')
    expect(body.meta.has_more).toBe(true)
    expect(body.meta.request_id).toBe('req_test2')
    expect(body.links.self).toBe('/v1/contacts')
  })

  describe('links.next (T9/L7)', () => {
    it('builds links.next with the new cursor when hasMore is true', async () => {
      const app = createTestApp()
      app.get('/v1/contacts', (c) => {
        const records = [{ id: 'c_001' }]
        const page = { data: records, nextCursor: 'cursor_xyz', hasMore: true }
        return c.json(toEnvelope(c, records, page))
      })

      const res = await app.request('/v1/contacts?limit=25')
      const body = (await res.json()) as OrbitEnvelope<{ id: string }[]>
      expect(body.links.next).toBeDefined()
      // The next URL should contain the new cursor and be server-relative.
      expect(body.links.next).toContain('cursor=cursor_xyz')
      expect(body.links.next).toContain('/v1/contacts')
      // The original limit query param should be preserved.
      expect(body.links.next).toContain('limit=25')
    })

    it('overwrites an existing cursor query param', async () => {
      const app = createTestApp()
      app.get('/v1/contacts', (c) => {
        const records = [{ id: 'c_002' }]
        const page = { data: records, nextCursor: 'cursor_page2', hasMore: true }
        return c.json(toEnvelope(c, records, page))
      })

      const res = await app.request('/v1/contacts?cursor=cursor_page1')
      const body = (await res.json()) as OrbitEnvelope<{ id: string }[]>
      expect(body.links.next).toContain('cursor=cursor_page2')
      expect(body.links.next).not.toContain('cursor_page1')
    })

    it('omits links.next when hasMore is false', async () => {
      const app = createTestApp()
      app.get('/v1/contacts', (c) => {
        const records = [{ id: 'c_001' }]
        const page = { data: records, nextCursor: null, hasMore: false }
        return c.json(toEnvelope(c, records, page))
      })

      const res = await app.request('/v1/contacts')
      const body = (await res.json()) as OrbitEnvelope<{ id: string }[]>
      expect(body.links.next).toBeUndefined()
    })
  })
})

// --- toError ---

describe('toError', () => {
  it('returns a standard error envelope', async () => {
    const app = createTestApp()
    app.get('/v1/fail', (c) => {
      return c.json(
        toError(c, 'VALIDATION_FAILED', 'Name is required', {
          field: 'name',
        }),
        400,
      )
    })

    const res = await app.request('/v1/fail', {
      headers: { 'x-request-id': 'req_err1' },
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      error: {
        code: string
        message: string
        request_id: string
        field: string
        retryable: boolean
      }
    }
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.message).toBe('Name is required')
    expect(body.error.request_id).toBe('req_err1')
    expect(body.error.field).toBe('name')
    expect(body.error.retryable).toBe(false)
  })
})

// --- errorHandlerMiddleware ---

describe('errorHandlerMiddleware', () => {
  it('catches OrbitError and returns proper status + envelope', async () => {
    const app = createTestApp()
    app.get('/v1/boom', () => {
      throw new OrbitError({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Contact not found',
        hint: 'Check the ID',
      })
    })

    const res = await app.request('/v1/boom', {
      headers: { 'x-request-id': 'req_boom1' },
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: {
        code: string
        message: string
        request_id: string
        hint: string
        retryable: boolean
      }
    }
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
    expect(body.error.message).toBe('Contact not found')
    expect(body.error.request_id).toBe('req_boom1')
    expect(body.error.hint).toBe('Check the ID')
    expect(body.error.retryable).toBe(false)
  })

  it('catches unknown errors as INTERNAL_ERROR (500)', async () => {
    const app = createTestApp()
    app.get('/v1/crash', () => {
      throw new Error('something broke')
    })

    const res = await app.request('/v1/crash', {
      headers: { 'x-request-id': 'req_crash1' },
    })
    expect(res.status).toBe(500)
    const body = (await res.json()) as {
      error: { code: string; message: string; request_id: string }
    }
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('An unexpected error occurred')
    expect(body.error.request_id).toBe('req_crash1')
  })

  it('maps AUTH_INVALID_API_KEY to 401', async () => {
    const app = createTestApp()
    app.get('/v1/auth-fail', () => {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'Bad key',
      })
    })

    const res = await app.request('/v1/auth-fail')
    expect(res.status).toBe(401)
  })

  it('maps RATE_LIMITED to 429', async () => {
    const app = createTestApp()
    app.get('/v1/rate', () => {
      throw new OrbitError({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryable: true,
      })
    })

    const res = await app.request('/v1/rate')
    expect(res.status).toBe(429)
    const body = (await res.json()) as {
      error: { retryable: boolean }
    }
    expect(body.error.retryable).toBe(true)
  })
})

// --- Sanitization ---

describe('toWebhookRead', () => {
  it('strips secretEncrypted and exposes last four of secret', () => {
    const raw = {
      id: 'wh_001',
      organization_id: 'org_001',
      url: 'https://example.com/hook',
      events: ['contact.created'],
      status: 'active' as const,
      description: null,
      secret_last_four: 'ab12',
      secret_created_at: '2026-01-01T00:00:00Z',
      secretEncrypted: 'enc_should_not_appear',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const result = toWebhookRead(raw)
    expect(result.signing_secret_last_four).toBe('ab12')
    expect(result).not.toHaveProperty('secretEncrypted')
    expect(result.object).toBe('webhook')
  })
})

describe('toWebhookDeliveryRead', () => {
  it('strips payload, signature, and responseBody', () => {
    const raw = {
      id: 'del_001',
      organization_id: 'org_001',
      webhook_id: 'wh_001',
      event_id: 'evt_001',
      status: 'succeeded' as const,
      response_status: 200,
      attempt_count: 1,
      next_attempt_at: null,
      delivered_at: '2026-01-01T00:00:00Z',
      last_error: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      payload: '{"should":"not appear"}',
      signature: 'sig_secret',
      responseBody: '{"also":"hidden"}',
    }
    const result = toWebhookDeliveryRead(raw)
    expect(result.object).toBe('webhook_delivery')
    expect(result.response_status).toBe(200)
    expect(result).not.toHaveProperty('payload')
    expect(result).not.toHaveProperty('signature')
    expect(result).not.toHaveProperty('responseBody')
  })
})
