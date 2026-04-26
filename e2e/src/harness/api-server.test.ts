import { describe, expect, it } from 'vitest'
import { startApiServer } from './api-server.js'

describe('startApiServer', () => {
  it('binds locally, forwards method/headers/body through api.fetch, and closes', async () => {
    const seen: Array<{ method: string; url: string; auth: string | null; body: string }> = []
    const server = await startApiServer({
      async fetch(request) {
        seen.push({
          method: request.method,
          url: request.url,
          auth: request.headers.get('authorization'),
          body: await request.text(),
        })
        return Response.json({ ok: true }, { status: 202, headers: { 'x-orbit-test': 'forwarded' } })
      },
    })

    expect(server.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    try {
      const response = await fetch(`${server.baseUrl}/v1/contacts?limit=1`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'API Server Test' }),
      })

      expect(response.status).toBe(202)
      expect(response.headers.get('x-orbit-test')).toBe('forwarded')
      await expect(response.json()).resolves.toEqual({ ok: true })
      expect(seen).toEqual([
        {
          method: 'POST',
          url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/v1\/contacts\?limit=1$/),
          auth: 'Bearer test-key',
          body: JSON.stringify({ name: 'API Server Test' }),
        },
      ])
    } finally {
      await server.close()
    }

    await expect(fetch(`${server.baseUrl}/v1/contacts`)).rejects.toThrow()
  })
})
