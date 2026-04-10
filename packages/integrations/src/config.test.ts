import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadIntegrationConfig, validateConnectorConfig, loadEnabledIntegrations } from './config.js'
import { IntegrationRegistry } from './registry.js'
import type { OrbitIntegrationPlugin } from './types.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

import { readFile } from 'node:fs/promises'

const mockReadFile = vi.mocked(readFile)

function makePlugin(slug: string): OrbitIntegrationPlugin {
  return {
    slug,
    title: `Plugin ${slug}`,
    version: '1.0.0',
    commands: [],
    tools: [],
    outboundEventHandlers: {},
    install: async () => {},
    uninstall: async () => {},
    healthcheck: async () => ({ healthy: true }),
  }
}

describe('loadIntegrationConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns parsed config from a valid config file', async () => {
    const raw = JSON.stringify({
      integrations: {
        gmail: { enabled: true, config: { clientId: 'abc' } },
        stripe: { enabled: false, config: {} },
      },
    })
    mockReadFile.mockResolvedValue(raw as never)

    const result = await loadIntegrationConfig('/some/path/.orbit/integrations.json')

    expect(result).toEqual({
      integrations: {
        gmail: { enabled: true, config: { clientId: 'abc' } },
        stripe: { enabled: false, config: {} },
      },
    })
  })

  it('returns empty config when file does not exist (ENOENT)', async () => {
    const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockReadFile.mockRejectedValue(enoentError as never)

    const result = await loadIntegrationConfig('/nonexistent/.orbit/integrations.json')

    expect(result).toEqual({ integrations: {} })
  })

  it('throws on invalid JSON', async () => {
    mockReadFile.mockResolvedValue('not valid json{{{' as never)

    await expect(loadIntegrationConfig('/some/path/integrations.json')).rejects.toThrow()
  })

  it('throws with details on invalid schema', async () => {
    const raw = JSON.stringify({
      integrations: {
        gmail: { enabled: 'not-a-boolean' }, // enabled must be boolean
      },
    })
    mockReadFile.mockResolvedValue(raw as never)

    await expect(loadIntegrationConfig('/some/path/integrations.json')).rejects.toThrow(
      'Invalid integrations config',
    )
  })

  it('applies defaults for missing optional fields', async () => {
    const raw = JSON.stringify({ integrations: { gmail: {} } })
    mockReadFile.mockResolvedValue(raw as never)

    const result = await loadIntegrationConfig('/some/path/integrations.json')

    expect(result.integrations['gmail']).toEqual({ enabled: true, config: {} })
  })
})

describe('validateConnectorConfig', () => {
  it('returns true for valid slug and config', () => {
    expect(validateConnectorConfig('gmail', { clientId: 'abc' })).toBe(true)
  })

  it('returns true for empty config object', () => {
    expect(validateConnectorConfig('stripe', {})).toBe(true)
  })

  it('throws when slug is empty string', () => {
    expect(() => validateConnectorConfig('', {})).toThrow(
      'Connector slug must be a non-empty string',
    )
  })

  it('throws when config is not an object', () => {
    expect(() =>
      validateConnectorConfig('gmail', null as unknown as Record<string, unknown>),
    ).toThrow("Config for connector 'gmail' must be an object")
  })
})

describe('loadEnabledIntegrations', () => {
  let registry: IntegrationRegistry

  beforeEach(() => {
    registry = new IntegrationRegistry()
  })

  it('returns only enabled AND registered plugins', () => {
    const gmail = makePlugin('gmail')
    const stripe = makePlugin('stripe')
    registry.register(gmail)
    registry.register(stripe)

    const config = {
      integrations: {
        gmail: { enabled: true, config: {} },
        stripe: { enabled: true, config: {} },
      },
    }

    const result = loadEnabledIntegrations(registry, config)
    expect(result).toHaveLength(2)
    expect(result).toContain(gmail)
    expect(result).toContain(stripe)
  })

  it('skips disabled plugins', () => {
    const gmail = makePlugin('gmail')
    registry.register(gmail)

    const config = {
      integrations: {
        gmail: { enabled: false, config: {} },
      },
    }

    const result = loadEnabledIntegrations(registry, config)
    expect(result).toHaveLength(0)
  })

  it('skips slugs not in registry', () => {
    const config = {
      integrations: {
        unknown: { enabled: true, config: {} },
      },
    }

    const result = loadEnabledIntegrations(registry, config)
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty config', () => {
    const result = loadEnabledIntegrations(registry, { integrations: {} })
    expect(result).toHaveLength(0)
  })

  it('accepts optional context argument without error', () => {
    const gmail = makePlugin('gmail')
    registry.register(gmail)
    const config = {
      integrations: { gmail: { enabled: true, config: {} } },
    }
    const result = loadEnabledIntegrations(registry, config, { orgId: 'org_123' })
    expect(result).toContain(gmail)
  })
})
