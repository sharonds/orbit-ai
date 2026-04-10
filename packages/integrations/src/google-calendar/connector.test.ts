import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { calendarPlugin, resolveCalendarConfig, CALENDAR_SLUG } from './connector.js'
import { calendarConnectorConfigSchema } from './types.js'
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
  clientSecretEnv: 'CALENDAR_CLIENT_SECRET',
  redirectUri: 'https://example.com/callback',
}

describe('calendarPlugin', () => {
  it('has slug "google-calendar"', () => {
    expect(calendarPlugin.slug).toBe('google-calendar')
  })

  it('has empty commands array (populated in later slice)', () => {
    expect(calendarPlugin.commands).toEqual([])
  })

  it('has empty tools array (populated in later slice)', () => {
    expect(calendarPlugin.tools).toEqual([])
  })

  describe('install', () => {
    let originalEnv: string | undefined

    beforeEach(() => {
      originalEnv = process.env['CALENDAR_CLIENT_SECRET']
      process.env['CALENDAR_CLIENT_SECRET'] = 'test-secret-value'
    })

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env['CALENDAR_CLIENT_SECRET']
      } else {
        process.env['CALENDAR_CLIENT_SECRET'] = originalEnv
      }
    })

    it('validates config and checks env var', async () => {
      const runtime = makeRuntime(validConfig)
      await expect(calendarPlugin.install(runtime)).resolves.toBeUndefined()
    })

    it('throws INVALID_INPUT when config is invalid', async () => {
      const runtime = makeRuntime({ clientId: '' })
      try {
        await calendarPlugin.install(runtime)
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.provider).toBe(CALENDAR_SLUG)
        }
      }
    })

    it('throws when env var is missing', async () => {
      delete process.env['CALENDAR_CLIENT_SECRET']
      const runtime = makeRuntime(validConfig)
      try {
        await calendarPlugin.install(runtime)
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.message).toContain('CALENDAR_CLIENT_SECRET')
        }
      }
    })
  })

  describe('healthcheck', () => {
    it('returns healthy', async () => {
      const runtime = makeRuntime(validConfig)
      const result = await calendarPlugin.healthcheck(runtime)
      expect(result).toEqual({ healthy: true })
    })
  })
})

describe('resolveCalendarConfig', () => {
  it('returns parsed config for valid input', () => {
    const config = resolveCalendarConfig(validConfig)
    expect(config.clientId).toBe('test-client-id')
    expect(config.clientSecretEnv).toBe('CALENDAR_CLIENT_SECRET')
    expect(config.redirectUri).toBe('https://example.com/callback')
    expect(config.scopes).toHaveLength(2)
  })

  it('throws INVALID_INPUT when clientId is missing', () => {
    try {
      resolveCalendarConfig({ clientSecretEnv: 'SECRET', redirectUri: 'https://example.com/cb' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('INVALID_INPUT')
        expect(err.provider).toBe(CALENDAR_SLUG)
      }
    }
  })

  it('throws INVALID_INPUT when redirectUri is not a URL', () => {
    try {
      resolveCalendarConfig({
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

describe('calendarConnectorConfigSchema', () => {
  it('defaults scopes when not provided', () => {
    const result = calendarConnectorConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scopes).toEqual([
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ])
    }
  })

  it('accepts custom scopes', () => {
    const result = calendarConnectorConfigSchema.safeParse({
      ...validConfig,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scopes).toEqual(['https://www.googleapis.com/auth/calendar.readonly'])
    }
  })
})
