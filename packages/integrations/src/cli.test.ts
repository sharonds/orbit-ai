import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getIntegrationCommands, getIntegrationTools, registerIntegrationCommands } from './cli.js'
import { IntegrationRegistry } from './registry.js'
import type { OrbitIntegrationPlugin, IntegrationTool, IntegrationCommand } from './types.js'
import { z } from 'zod'

function makePlugin(slug: string, overrides?: Partial<OrbitIntegrationPlugin>): OrbitIntegrationPlugin {
  return {
    slug,
    title: `Plugin ${slug}`,
    version: '0.1.0',
    commands: [],
    tools: [],
    outboundEventHandlers: {},
    install: vi.fn(),
    uninstall: vi.fn(),
    healthcheck: vi.fn().mockResolvedValue({ healthy: true }),
    ...overrides,
  }
}

function makeTool(name: string): IntegrationTool {
  return {
    name,
    description: `Tool ${name}`,
    inputSchema: z.object({}),
    execute: vi.fn().mockResolvedValue({}),
  }
}

function makeCommand(name: string): IntegrationCommand {
  return {
    name,
    description: `Command ${name}`,
    action: vi.fn(),
  }
}

describe('getIntegrationTools', () => {
  let registry: IntegrationRegistry

  beforeEach(() => {
    registry = new IntegrationRegistry()
  })

  it('returns tools from enabled plugins only', () => {
    const tool1 = makeTool('integrations.gmail.send')
    const tool2 = makeTool('integrations.stripe.charge')
    const gmail = makePlugin('gmail', { tools: [tool1] })
    const stripe = makePlugin('stripe', { tools: [tool2] })
    registry.register(gmail)
    registry.register(stripe)

    const config = {
      integrations: {
        gmail: { enabled: true, config: {} },
        stripe: { enabled: false, config: {} },
      },
    }

    const result = getIntegrationTools(registry, config)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(tool1)
  })

  it('skips tools without integrations. prefix and logs error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const badTool = makeTool('gmail.send') // missing 'integrations.' prefix
    const gmail = makePlugin('gmail', { tools: [badTool] })
    registry.register(gmail)

    const config = {
      integrations: { gmail: { enabled: true, config: {} } },
    }

    const result = getIntegrationTools(registry, config)
    expect(result).toHaveLength(0)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping tool 'gmail.send'"),
    )
    spy.mockRestore()
  })

  it('skips duplicate tool names and logs error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tool1 = makeTool('integrations.shared.lookup')
    const tool2 = makeTool('integrations.shared.lookup')
    const pluginA = makePlugin('gmail', { tools: [tool1] })
    const pluginB = makePlugin('stripe', { tools: [tool2] })
    registry.register(pluginA)
    registry.register(pluginB)

    const config = {
      integrations: {
        gmail: { enabled: true, config: {} },
        stripe: { enabled: true, config: {} },
      },
    }

    const result = getIntegrationTools(registry, config)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(tool1)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping duplicate tool name 'integrations.shared.lookup'"),
    )
    spy.mockRestore()
  })

  it('returns empty array when no plugins enabled', () => {
    const gmail = makePlugin('gmail', { tools: [makeTool('integrations.gmail.send')] })
    registry.register(gmail)

    const config = {
      integrations: { gmail: { enabled: false, config: {} } },
    }

    const result = getIntegrationTools(registry, config)
    expect(result).toEqual([])
  })
})

describe('getIntegrationCommands', () => {
  let registry: IntegrationRegistry

  beforeEach(() => {
    registry = new IntegrationRegistry()
  })

  it('returns commands from enabled plugins', () => {
    const cmd1 = makeCommand('gmail:sync')
    const cmd2 = makeCommand('stripe:sync')
    const gmail = makePlugin('gmail', { commands: [cmd1] })
    const stripe = makePlugin('stripe', { commands: [cmd2] })
    registry.register(gmail)
    registry.register(stripe)

    const config = {
      integrations: {
        gmail: { enabled: true, config: {} },
        stripe: { enabled: true, config: {} },
      },
    }

    const result = getIntegrationCommands(registry, config)
    expect(result).toHaveLength(2)
    expect(result).toContain(cmd1)
    expect(result).toContain(cmd2)
  })

  it('returns empty array when all disabled', () => {
    const gmail = makePlugin('gmail', { commands: [makeCommand('gmail:sync')] })
    registry.register(gmail)

    const config = {
      integrations: { gmail: { enabled: false, config: {} } },
    }

    const result = getIntegrationCommands(registry, config)
    expect(result).toEqual([])
  })
})

describe('registerIntegrationCommands', () => {
  it('is a function (shape check)', () => {
    expect(typeof registerIntegrationCommands).toBe('function')
  })

  it('preserves boolean false default — does not stringify to "false"', () => {
    const { Command } = require('commander') as typeof import('commander')
    const program = new Command()
    program.command('integrations').description('Manage integrations')

    const boolCmd: IntegrationCommand = {
      name: 'stripe',
      description: 'Stripe integration',
      action: vi.fn(),
      options: [
        { flags: '--live', description: 'Use live mode', defaultValue: false },
      ],
    }
    const plugin = makePlugin('stripe', { commands: [boolCmd] })
    const registry = new IntegrationRegistry()
    registry.register(plugin)

    const config = { integrations: { stripe: { enabled: true, config: {} } } }
    registerIntegrationCommands(program, registry, config)

    const intCmd = program.commands.find((c: { name: () => string }) => c.name() === 'integrations')
    const stripeCmd = intCmd?.commands.find((c: { name: () => string }) => c.name() === 'stripe')
    expect(stripeCmd).toBeDefined()

    const liveOption = stripeCmd!.options.find((o: { flags: string }) => o.flags === '--live')
    expect(liveOption).toBeDefined()
    // Must be boolean false, NOT the string 'false' (which is truthy)
    expect(liveOption!.defaultValue).toBe(false)
    expect(liveOption!.defaultValue).not.toBe('false')
  })

  it('preserves boolean true default — does not stringify to "true"', () => {
    const { Command } = require('commander') as typeof import('commander')
    const program = new Command()
    program.command('integrations').description('Manage integrations')

    const boolCmd: IntegrationCommand = {
      name: 'gmail',
      description: 'Gmail integration',
      action: vi.fn(),
      options: [
        { flags: '--auto-sync', description: 'Enable auto sync', defaultValue: true },
      ],
    }
    const plugin = makePlugin('gmail', { commands: [boolCmd] })
    const registry = new IntegrationRegistry()
    registry.register(plugin)

    const config = { integrations: { gmail: { enabled: true, config: {} } } }
    registerIntegrationCommands(program, registry, config)

    const intCmd = program.commands.find((c: { name: () => string }) => c.name() === 'integrations')
    const gmailCmd = intCmd?.commands.find((c: { name: () => string }) => c.name() === 'gmail')
    expect(gmailCmd).toBeDefined()

    const autoSyncOption = gmailCmd!.options.find((o: { flags: string }) => o.flags === '--auto-sync')
    expect(autoSyncOption).toBeDefined()
    expect(autoSyncOption!.defaultValue).toBe(true)
    expect(autoSyncOption!.defaultValue).not.toBe('true')
  })
})
