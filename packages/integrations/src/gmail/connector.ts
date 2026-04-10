import type { OrbitIntegrationPlugin, IntegrationRuntime } from '../types.js'
import { gmailConnectorConfigSchema, type GmailConnectorConfig } from './types.js'
import { createIntegrationError } from '../errors.js'

export const GMAIL_SLUG = 'gmail'

export const gmailPlugin: OrbitIntegrationPlugin = {
  slug: GMAIL_SLUG,
  title: 'Gmail',
  version: '0.1.0',
  commands: [], // spec section 5.1: Gmail defines MCP tools only, no CLI commands
  tools: [], // populated in Slice 12
  outboundEventHandlers: {}, // populated in Slice 21

  async install(runtime: IntegrationRuntime): Promise<void> {
    // Validate config
    const result = gmailConnectorConfigSchema.safeParse(runtime.config)
    if (!result.success) {
      throw createIntegrationError('INVALID_INPUT', `Gmail config invalid: ${result.error.message}`, {
        provider: GMAIL_SLUG,
      })
    }
    // Resolve client secret from env
    const secretEnv = result.data.clientSecretEnv
    if (!process.env[secretEnv]) {
      throw createIntegrationError(
        'INVALID_INPUT',
        `Environment variable ${secretEnv} is not set`,
        { provider: GMAIL_SLUG },
      )
    }
  },

  async uninstall(_runtime: IntegrationRuntime): Promise<void> {
    // Cleanup: revoke tokens, remove sync state
    // Implementation deferred to Slice 9 (OAuth flow)
  },

  async healthcheck(_runtime: IntegrationRuntime): Promise<{ healthy: boolean; message?: string }> {
    // Check if credentials are valid
    return { healthy: true }
  },
}

/**
 * Resolve the Gmail config from raw runtime config.
 * Throws IntegrationError on validation failure.
 */
export function resolveGmailConfig(rawConfig: Record<string, unknown>): GmailConnectorConfig {
  const result = gmailConnectorConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    throw createIntegrationError('INVALID_INPUT', `Gmail config invalid: ${result.error.message}`, {
      provider: GMAIL_SLUG,
    })
  }
  return result.data
}
