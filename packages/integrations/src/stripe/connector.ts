import type { OrbitIntegrationPlugin, IntegrationRuntime } from '../types.js'
import { stripeConnectorConfigSchema, type StripeConnectorConfig } from './types.js'
import { createIntegrationError } from '../errors.js'

export const STRIPE_SLUG = 'stripe'

export const stripePlugin: OrbitIntegrationPlugin = {
  slug: STRIPE_SLUG,
  title: 'Stripe',
  version: '0.1.0',
  commands: [],
  tools: [],
  outboundEventHandlers: {},

  async install(runtime: IntegrationRuntime): Promise<void> {
    const result = stripeConnectorConfigSchema.safeParse(runtime.config)
    if (!result.success) {
      throw createIntegrationError('INVALID_INPUT', `Stripe config invalid: ${result.error.message}`, {
        provider: STRIPE_SLUG,
      })
    }
    // Verify env vars exist (never read actual values into config objects)
    if (!process.env[result.data.secretKeyEnv]) {
      throw createIntegrationError(
        'INVALID_INPUT',
        `Environment variable ${result.data.secretKeyEnv} is not set`,
        { provider: STRIPE_SLUG },
      )
    }
    if (!process.env[result.data.webhookSecretEnv]) {
      throw createIntegrationError(
        'INVALID_INPUT',
        `Environment variable ${result.data.webhookSecretEnv} is not set`,
        { provider: STRIPE_SLUG },
      )
    }
  },

  async uninstall(_runtime: IntegrationRuntime): Promise<void> {
    // No persistent resources to clean up in scaffold
  },

  async healthcheck(_runtime: IntegrationRuntime): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true }
  },
}

export function resolveStripeConfig(rawConfig: Record<string, unknown>): StripeConnectorConfig {
  const result = stripeConnectorConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    throw createIntegrationError('INVALID_INPUT', `Stripe config invalid: ${result.error.message}`, {
      provider: STRIPE_SLUG,
    })
  }
  return result.data
}

/**
 * Get the Stripe secret key from env. Secret is read at call time — never stored.
 */
export function getStripeSecretKey(config: StripeConnectorConfig): string {
  const key = process.env[config.secretKeyEnv]
  if (!key) {
    throw createIntegrationError(
      'INVALID_INPUT',
      `Environment variable ${config.secretKeyEnv} is not set`,
      { provider: STRIPE_SLUG },
    )
  }
  return key
}
