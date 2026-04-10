import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { stripePlugin, resolveStripeConfig, getStripeSecretKey, STRIPE_SLUG } from './connector.js'
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
  secretKeyEnv: 'STRIPE_SECRET_KEY',
  webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',
}

describe('stripePlugin', () => {
  it('has slug "stripe"', () => {
    expect(stripePlugin.slug).toBe('stripe')
  })

  it('has empty commands array', () => {
    expect(stripePlugin.commands).toEqual([])
  })

  it('has empty tools array', () => {
    expect(stripePlugin.tools).toEqual([])
  })

  describe('install', () => {
    let savedSecretKey: string | undefined
    let savedWebhookSecret: string | undefined

    beforeEach(() => {
      savedSecretKey = process.env['STRIPE_SECRET_KEY']
      savedWebhookSecret = process.env['STRIPE_WEBHOOK_SECRET']
    })

    afterEach(() => {
      if (savedSecretKey !== undefined) {
        process.env['STRIPE_SECRET_KEY'] = savedSecretKey
      } else {
        delete process.env['STRIPE_SECRET_KEY']
      }
      if (savedWebhookSecret !== undefined) {
        process.env['STRIPE_WEBHOOK_SECRET'] = savedWebhookSecret
      } else {
        delete process.env['STRIPE_WEBHOOK_SECRET']
      }
    })

    it('validates config and succeeds when both env vars are set', async () => {
      process.env['STRIPE_SECRET_KEY'] = 'sk_test_123'
      process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_456'
      await expect(stripePlugin.install(makeRuntime(validConfig))).resolves.toBeUndefined()
    })

    it('throws INVALID_INPUT when config is invalid', async () => {
      try {
        await stripePlugin.install(makeRuntime({ secretKeyEnv: '' }))
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.provider).toBe('stripe')
        }
      }
    })

    it('throws when secretKeyEnv env var is not set', async () => {
      delete process.env['STRIPE_SECRET_KEY']
      process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_456'
      try {
        await stripePlugin.install(makeRuntime(validConfig))
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.message).toContain('STRIPE_SECRET_KEY')
        }
      }
    })

    it('throws when webhookSecretEnv env var is not set', async () => {
      process.env['STRIPE_SECRET_KEY'] = 'sk_test_123'
      delete process.env['STRIPE_WEBHOOK_SECRET']
      try {
        await stripePlugin.install(makeRuntime(validConfig))
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('INVALID_INPUT')
          expect(err.message).toContain('STRIPE_WEBHOOK_SECRET')
        }
      }
    })
  })

  describe('uninstall', () => {
    it('resolves without error', async () => {
      await expect(stripePlugin.uninstall(makeRuntime({}))).resolves.toBeUndefined()
    })
  })

  describe('healthcheck', () => {
    it('returns healthy true', async () => {
      const result = await stripePlugin.healthcheck(makeRuntime({}))
      expect(result).toEqual({ healthy: true })
    })
  })
})

describe('resolveStripeConfig', () => {
  it('parses valid config', () => {
    const config = resolveStripeConfig(validConfig)
    expect(config.secretKeyEnv).toBe('STRIPE_SECRET_KEY')
    expect(config.webhookSecretEnv).toBe('STRIPE_WEBHOOK_SECRET')
  })

  it('throws INVALID_INPUT for missing secretKeyEnv', () => {
    try {
      resolveStripeConfig({ webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('INVALID_INPUT')
        expect(err.provider).toBe('stripe')
      }
    }
  })

  it('throws INVALID_INPUT for empty secretKeyEnv', () => {
    try {
      resolveStripeConfig({ secretKeyEnv: '', webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('INVALID_INPUT')
      }
    }
  })
})

describe('getStripeSecretKey', () => {
  let savedKey: string | undefined

  beforeEach(() => {
    savedKey = process.env['STRIPE_SECRET_KEY']
  })

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env['STRIPE_SECRET_KEY'] = savedKey
    } else {
      delete process.env['STRIPE_SECRET_KEY']
    }
  })

  it('reads secret key from env', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc'
    const key = getStripeSecretKey({ secretKeyEnv: 'STRIPE_SECRET_KEY', webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET' })
    expect(key).toBe('sk_test_abc')
  })

  it('throws INVALID_INPUT when env var is missing', () => {
    delete process.env['STRIPE_SECRET_KEY']
    try {
      getStripeSecretKey({ secretKeyEnv: 'STRIPE_SECRET_KEY', webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('INVALID_INPUT')
        expect(err.message).toContain('STRIPE_SECRET_KEY')
      }
    }
  })
})
