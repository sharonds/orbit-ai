import { describe, it, expect, beforeEach } from 'vitest'
import { IntegrationRegistry } from './registry.js'
import type { OrbitIntegrationPlugin } from './types.js'

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

describe('IntegrationRegistry', () => {
  let registry: IntegrationRegistry

  beforeEach(() => {
    registry = new IntegrationRegistry()
  })

  it('register adds a plugin', () => {
    const plugin = makePlugin('gmail')
    registry.register(plugin)
    expect(registry.get('gmail')).toBe(plugin)
  })

  it('register throws on duplicate slug', () => {
    const plugin = makePlugin('gmail')
    registry.register(plugin)
    expect(() => registry.register(makePlugin('gmail'))).toThrow(
      "Integration plugin 'gmail' is already registered",
    )
  })

  it('get returns registered plugin', () => {
    const plugin = makePlugin('stripe')
    registry.register(plugin)
    expect(registry.get('stripe')).toBe(plugin)
  })

  it('get returns undefined for unknown slug', () => {
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('list returns all registered plugins', () => {
    const a = makePlugin('gmail')
    const b = makePlugin('stripe')
    registry.register(a)
    registry.register(b)
    const list = registry.list()
    expect(list).toHaveLength(2)
    expect(list).toContain(a)
    expect(list).toContain(b)
  })

  it('list returns empty array when no plugins registered', () => {
    expect(registry.list()).toEqual([])
  })

  it('has returns true for registered plugin', () => {
    registry.register(makePlugin('gmail'))
    expect(registry.has('gmail')).toBe(true)
  })

  it('has returns false for unknown slug', () => {
    expect(registry.has('unknown')).toBe(false)
  })

  it('unregister removes a plugin and returns true', () => {
    registry.register(makePlugin('gmail'))
    expect(registry.unregister('gmail')).toBe(true)
    expect(registry.has('gmail')).toBe(false)
    expect(registry.get('gmail')).toBeUndefined()
  })

  it('unregister returns false for unknown slug', () => {
    expect(registry.unregister('nonexistent')).toBe(false)
  })
})
