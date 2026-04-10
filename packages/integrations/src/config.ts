import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { OrbitIntegrationPlugin } from './types.js'
import type { IntegrationRegistry } from './registry.js'

// Per spec section 4: .orbit/integrations.json format
const connectorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
})

const integrationsConfigSchema = z.object({
  integrations: z.record(z.string(), connectorConfigSchema).default({}),
})

export type IntegrationsConfig = z.infer<typeof integrationsConfigSchema>
export type ConnectorConfig = z.infer<typeof connectorConfigSchema>

/**
 * Load and validate .orbit/integrations.json from the given path.
 * Returns empty config if file does not exist.
 */
export async function loadIntegrationConfig(configPath: string): Promise<IntegrationsConfig> {
  try {
    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    const result = integrationsConfigSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`Invalid integrations config at ${configPath}: ${result.error.message}`)
    }
    return result.data
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist — return empty config
      return { integrations: {} }
    }
    throw err
  }
}

/**
 * Validate connector-specific config for a given slug.
 * Returns true if valid, throws with details if not.
 */
export function validateConnectorConfig(slug: string, config: Record<string, unknown>): true {
  // Basic validation — connector-specific validation happens in the connector's install()
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('Connector slug must be a non-empty string')
  }
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Config for connector '${slug}' must be an object`)
  }
  return true
}

/**
 * Load and return enabled integrations from the registry based on config.
 * Only returns plugins that are registered AND enabled in config.
 */
export function loadEnabledIntegrations(
  registry: IntegrationRegistry,
  config: IntegrationsConfig,
  _context?: { orgId?: string },
): OrbitIntegrationPlugin[] {
  const enabled: OrbitIntegrationPlugin[] = []
  for (const [slug, connectorConfig] of Object.entries(config.integrations)) {
    if (!connectorConfig.enabled) continue
    const plugin = registry.get(slug)
    if (!plugin) continue // registered but not in registry is silently skipped
    enabled.push(plugin)
  }
  return enabled
}
