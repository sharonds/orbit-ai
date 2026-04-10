import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { gmailPlugin, resolveGmailConfig, GMAIL_SLUG } from './connector.js'
import { gmailConnectorConfigSchema } from './types.js'
import type { IntegrationRuntime } from '../types.js'
import { isIntegrationError } from '../errors.js'

function makeRuntime(config: Record<string, unknown>): IntegrationRuntime {
  return {
    adapter: {},
    client: {},
    config,
    eventBus: {
      publish: async () => {},
      subscribe: () => {},
    },
  }
}

const validConfig = {
  clientId: 'test-client-id',
  clientSecretEnv: 'GMAIL_CLIENT_SECRET',
  redirectUri: 'https://example.com/callback',
}

describe('gmailPlugin', () => {
  it('has slug "gmail"', () => {
    expect(gmailPlugin.slug).toBe('gmail')
  })

  it('has empty commands array (Gmail defines MCP tools only)', () => {
    expect(gmailPlugin.commands).toEqual([])
  })

  it('has empty tools array (populated in later slice)', () => {
    expect(gmailPlugin.tools).toEqual([])
  })

  describe('install', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
      originalEnv = process.env['GMAIL_CLIENT_SECRET']
      process.env['GMAIL_CLIENT_SECRET'] = 'test-secret-value'
    })

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env['GMAIL_CLIENT_SECRET']
      } else {
        process.env['GMAIL_CLIENT_SECRET'] = originalEnv
      }
    })

    it('validates config and checks env var', async () => {
      const runtime = makeRuntime(validConfig)
      await expect(gmailPlugin.install(runtime)).resolves.toBeUndefined()
    })

    it('throws INVALID_INPUT when config is invalid', async () => {
      const runtime = makeRuntime({ clientId: '' })
      try {
        await gmailPlugin.install(runtime)
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.provider).toBe(GMAIL_SLUG)
        }
      }
    })

    it('throws when env var is missing', async () => {
      delete process.env['GMAIL_CLIENT_SECRET']
      const runtime = makeRuntime(validConfig)
      try {
        await gmailPlugin.install(runtime)
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.message).toContain('GMAIL_CLIENT_SECRET')
        }
      }
    })
  })

  describe('healthcheck', () => {
    it('returns healthy', async () => {
      const runtime = makeRuntime(validConfig)
      const result = await gmailPlugin.healthcheck(runtime)
      expect(result).toEqual({ healthy: true })
    })
  })
})

describe('resolveGmailConfig', () => {
  it('returns parsed config for valid input', () => {
    const config = resolveGmailConfig(validConfig)
    expect(config.clientId).toBe('test-client-id')
    expect(config.clientSecretEnv).toBe('GMAIL_CLIENT_SECRET')
    expect(config.redirectUri).toBe('https://example.com/callback')
    expect(config.auto_create_contacts).toBe(true)
    expect(config.scopes).toHaveLength(3)
  })

  it('throws INVALID_INPUT when clientId is missing', () => {
    try {
      resolveGmailConfig({ clientSecretEnv: 'SECRET', redirectUri: 'https://example.com/cb' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('INVALID_INPUT')
        expect(err.provider).toBe(GMAIL_SLUG)
      }
    }
  })

  it('throws INVALID_INPUT when redirectUri is not a URL', () => {
    try {
      resolveGmailConfig({
        clientId: 'id',
        clientSecretEnv: 'SECRET',
        redirectUri: 'not-a-url',
      })
      expect.fail('should have thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('INVALID_INPUT')
      }
    }
  })
})

describe('gmailConnectorConfigSchema', () => {
  it('defaults scopes when not provided', () => {
    const result = gmailConnectorConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scopes).toEqual([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ])
    }
  })

  it('defaults auto_create_contacts to true', () => {
    const result = gmailConnectorConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.auto_create_contacts).toBe(true)
    }
  })

  it('accepts custom scopes', () => {
    const result = gmailConnectorConfigSchema.safeParse({
      ...validConfig,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scopes).toEqual(['https://www.googleapis.com/auth/gmail.readonly'])
    }
  })
})
