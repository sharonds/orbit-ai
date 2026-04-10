import { describe, it, expect, vi, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerIntegrationSubcommands, registerIntegrationsCommand } from '../commands/integrations.js'
import { createProgram } from '../program.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerIntegrationSubcommands', () => {
  it('registers two plugins as subcommands under integrations', () => {
    const program = new Command()
    const action1 = vi.fn()
    const action2 = vi.fn()

    registerIntegrationSubcommands(program, [
      { name: 'gmail', description: 'Gmail integration', action: action1 },
      { name: 'google-calendar', description: 'Google Calendar integration', action: action2 },
    ])

    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    expect(integrationsCmd).toBeDefined()

    const subNames = integrationsCmd!.commands.map((c) => c.name())
    expect(subNames).toContain('gmail')
    expect(subNames).toContain('google-calendar')
  })

  it('registers plugin options on the subcommand', () => {
    const program = new Command()

    registerIntegrationSubcommands(program, [
      {
        name: 'stripe',
        description: 'Stripe integration',
        action: vi.fn(),
        options: [
          { flags: '--webhook-secret <secret>', description: 'Stripe webhook secret' },
          { flags: '--live', description: 'Use live mode', defaultValue: false },
        ],
      },
    ])

    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    const stripeCmd = integrationsCmd?.commands.find((c) => c.name() === 'stripe')
    expect(stripeCmd).toBeDefined()

    const optionFlags = stripeCmd!.options.map((o) => o.flags)
    expect(optionFlags).toContain('--webhook-secret <secret>')
    expect(optionFlags).toContain('--live')
  })

  it('with empty plugins array registers the parent command with no subcommands', () => {
    const program = new Command()

    registerIntegrationSubcommands(program, [])

    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    expect(integrationsCmd).toBeDefined()
    expect(integrationsCmd!.commands).toHaveLength(0)
  })

  it('calls the action when a subcommand is parsed', async () => {
    const program = new Command()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })

    const action = vi.fn()
    registerIntegrationSubcommands(program, [
      { name: 'gmail', description: 'Gmail integration', action },
    ])

    await program.parseAsync(['node', 'orbit', 'integrations', 'gmail'])
    expect(action).toHaveBeenCalledOnce()
  })
})

describe('registerIntegrationsCommand', () => {
  it('registers the integrations command without throwing', () => {
    const program = new Command()
    expect(() => registerIntegrationsCommand(program)).not.toThrow()
    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    expect(integrationsCmd).toBeDefined()
  })

  it('does not throw when invoked with no plugins (shows help or exits cleanly)', () => {
    const program = new Command()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    registerIntegrationsCommand(program)
    // Parsing `integrations` with no subcommand should NOT throw a CliNotImplementedError
    expect(() =>
      program.parse(['node', 'orbit', 'integrations']),
    ).not.toThrow()
  })

  it('is idempotent — calling twice does not duplicate the command', () => {
    const program = new Command()
    registerIntegrationsCommand(program)
    registerIntegrationsCommand(program)
    const integrationsCmds = program.commands.filter((c) => c.name() === 'integrations')
    expect(integrationsCmds).toHaveLength(1)
  })
})

describe('top-level calendar alias', () => {
  it('registers a top-level calendar command on the program', () => {
    const program = createProgram()
    const names = program.commands.map((c) => c.name())
    expect(names).toContain('calendar')
  })

  it('calendar command has a description referencing google-calendar', () => {
    const program = createProgram()
    const calendarCmd = program.commands.find((c) => c.name() === 'calendar')
    expect(calendarCmd).toBeDefined()
    expect(calendarCmd!.description()).toContain('google-calendar')
  })
})
