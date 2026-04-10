import { describe, expect, it } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { toToolError } from '../errors.js'
import { sanitizeSecretBearingRecord, toMcpIntegrationConnectionRead } from '../output/sensitive.js'
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
      connection_type: 'oauth',
      status: 'active',
      failure_count: 0,
      scopes: ['calendar.read'],
      access_token: 'ya29.REALTOKEN',
      refresh_token: 'rt_REALREFRESH',
      client_secret: 'super-secret',
      private_key: 'PRIVATE',
    })
    const text = JSON.stringify(dto)
    expect(text).not.toContain('REALTOKEN')
    expect(text).not.toContain('REALREFRESH')
    expect(text).not.toContain('super-secret')
    expect(text).not.toContain('PRIVATE')
    expect(dto.object).toBe('integration_connection')
    expect(dto.credentials_redacted).toBe(true)
  })

  it('redacts token-like strings in tool errors', () => {
    const result = toToolError({ code: 'INTERNAL_ERROR', message: 'access_token: ya29.LEAKED' })
    expect(getTextContent(result)).not.toContain('ya29.LEAKED')
  })

  it('redacts jwt-like strings in tool errors', () => {
    const result = toToolError({ code: 'INTERNAL_ERROR', message: 'jwt eyJabc.def.ghi' })
    expect(getTextContent(result)).not.toContain('eyJabc.def.ghi')
  })

  it('sanitizeSecretBearingRecord strips sensitive keys in nested objects', () => {
    const result = sanitizeSecretBearingRecord('contacts', {
      id: 'contact_01',
      name: 'Jane',
      profile: {
        api_key: 'sk_live_nested_secret',
        bio: 'Developer',
      },
    }) as Record<string, unknown>
    const profile = result.profile as Record<string, unknown>
    expect(profile).not.toHaveProperty('api_key')
    expect(profile.bio).toBe('Developer')
    expect(result.name).toBe('Jane')
  })

  it('sanitizeSecretBearingRecord strips sensitive keys at all array depths', () => {
    const result = sanitizeSecretBearingRecord('contacts', {
      id: 'contact_01',
      connections: [{ api_key: 'sk_leaked', provider: 'google' }],
    }) as Record<string, unknown>
    const connections = result.connections as Array<Record<string, unknown>>
    expect(connections[0]).not.toHaveProperty('api_key')
    expect(connections[0]?.provider).toBe('google')
  })
})
