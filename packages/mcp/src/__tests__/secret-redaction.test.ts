import { describe, expect, it } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { toToolError } from '../errors.js'
import { toMcpIntegrationConnectionRead } from '../output/sensitive.js'
import { getTextContent, makeMockClient } from './helpers.js'

describe('secret redaction', () => {
  it('redacts webhook signing_secret in get_record', async () => {
    const client = makeMockClient()
    client.webhooks.get = async () => ({
      id: 'webhook_01',
      organization_id: 'org_01',
      url: 'https://example.com',
      events: ['contact.created'],
      status: 'active',
      description: null,
      signing_secret: 'whsec_SUPERSECRET',
      secret_last_four: 'CRET',
      created_at: '2026-04-10T00:00:00.000Z',
      updated_at: '2026-04-10T00:00:00.000Z',
    } as never)
    const result = await executeTool(client, 'get_record', { object_type: 'webhooks', record_id: 'webhook_01' })
    const text = getTextContent(result)
    expect(text).not.toContain('SUPERSECRET')
    expect(text).not.toContain('signing_secret')
  })

  it('redacts integration credentials', () => {
    const dto = toMcpIntegrationConnectionRead({
      id: 'conn_01',
      provider: 'google',
      organization_id: 'org_01',
      access_token: 'ya29.REALTOKEN',
      refresh_token: 'rt_REALREFRESH',
    })
    const text = JSON.stringify(dto)
    expect(text).not.toContain('REALTOKEN')
    expect(text).not.toContain('REALREFRESH')
    expect(dto.credentials_redacted).toBe(true)
  })

  it('redacts token-like strings in tool errors', () => {
    const result = toToolError({ code: 'INTERNAL_ERROR', message: 'access_token: ya29.LEAKED' })
    expect(getTextContent(result)).not.toContain('ya29.LEAKED')
  })
})
