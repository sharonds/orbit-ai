import type { OrbitIntegrationPlugin, IntegrationRuntime } from '../types.js'
import { calendarConnectorConfigSchema, type CalendarConnectorConfig } from './types.js'
import { createIntegrationError } from '../errors.js'

export const CALENDAR_SLUG = 'google-calendar'

export const calendarPlugin: OrbitIntegrationPlugin = {
  slug: CALENDAR_SLUG,
  title: 'Google Calendar',
  version: '0.1.0',
  commands: [],           // populated in Slice 16
  tools: [],              // populated in Slice 16
  outboundEventHandlers: {},

  async install(runtime: IntegrationRuntime): Promise<void> {
    const result = calendarConnectorConfigSchema.safeParse(runtime.config)
    if (!result.success) {
      throw createIntegrationError('INVALID_INPUT', `Calendar config invalid: ${result.error.message}`, {
        provider: CALENDAR_SLUG,
      })
    }
    const secretEnv = result.data.clientSecretEnv
    if (!process.env[secretEnv]) {
      throw createIntegrationError(
        'INVALID_INPUT',
        `Environment variable ${secretEnv} is not set`,
        { provider: CALENDAR_SLUG },
      )
    }
  },

  async uninstall(_runtime: IntegrationRuntime): Promise<void> {
    // Cleanup: revoke tokens, remove sync state
  },

  async healthcheck(_runtime: IntegrationRuntime): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true }
  },
}

/**
 * Resolve the Calendar config from raw runtime config.
 * Throws IntegrationError on validation failure.
 */
export function resolveCalendarConfig(rawConfig: Record<string, unknown>): CalendarConnectorConfig {
  const result = calendarConnectorConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    throw createIntegrationError('INVALID_INPUT', `Calendar config invalid: ${result.error.message}`, {
      provider: CALENDAR_SLUG,
    })
  }
  return result.data
}
