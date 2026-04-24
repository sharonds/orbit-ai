import { describe, it, expect, vi, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerIntegrationSubcommands, registerIntegrationsCommand } from '../commands/integrations.js'
import { registerCalendarAliasCommand } from '../commands/calendar-alias.js'
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

  it('preserves boolean false default without stringifying it', () => {
    const program = new Command()

    registerIntegrationSubcommands(program, [
      {
        name: 'stripe',
        description: 'Stripe integration',
        action: vi.fn(),
        options: [
          { flags: '--live', description: 'Use live mode', defaultValue: false },
        ],
      },
    ])

    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    const stripeCmd = integrationsCmd?.commands.find((c) => c.name() === 'stripe')
    const liveOption = stripeCmd!.options.find((o) => o.flags === '--live')
    expect(liveOption).toBeDefined()
    // Must be boolean false, NOT the string 'false' (which is truthy)
    expect(liveOption!.defaultValue).toBe(false)
    expect(liveOption!.defaultValue).not.toBe('false')
  })

  it('preserves boolean true default without stringifying it', () => {
    const program = new Command()

    registerIntegrationSubcommands(program, [
      {
        name: 'gmail',
        description: 'Gmail integration',
        action: vi.fn(),
        options: [
          { flags: '--auto-sync', description: 'Enable auto sync', defaultValue: true },
        ],
      },
    ])

    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    const gmailCmd = integrationsCmd?.commands.find((c) => c.name() === 'gmail')
    const autoSyncOption = gmailCmd!.options.find((o) => o.flags === '--auto-sync')
    expect(autoSyncOption).toBeDefined()
    expect(autoSyncOption!.defaultValue).toBe(true)
    expect(autoSyncOption!.defaultValue).not.toBe('true')
  })

  it('still stringifies non-boolean defaults', () => {
    const program = new Command()

    registerIntegrationSubcommands(program, [
      {
        name: 'stripe',
        description: 'Stripe integration',
        action: vi.fn(),
        options: [
          { flags: '--timeout <ms>', description: 'Timeout in ms', defaultValue: '5000' },
        ],
      },
    ])

    const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
    const stripeCmd = integrationsCmd?.commands.find((c) => c.name() === 'stripe')
    const timeoutOption = stripeCmd!.options.find((o) => o.flags === '--timeout <ms>')
    expect(timeoutOption).toBeDefined()
    expect(timeoutOption!.defaultValue).toBe('5000')
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

  it('awaits nested async integration actions and keeps root flags available', async () => {
    const program = new Command()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    program.option('--apply-integrations-schema')

    const action = vi.fn(async (...args: unknown[]) => {
      const command = args[args.length - 1] as Command
      let root: Command = command
      while (root.parent) root = root.parent
      expect(root.opts()).toMatchObject({ applyIntegrationsSchema: true })
      await new Promise((resolve) => setTimeout(resolve, 1))
    })

    registerIntegrationSubcommands(program, [
      { name: 'gmail/configure', description: 'Configure Gmail', action },
    ])

    await program.parseAsync(['node', 'orbit', '--apply-integrations-schema', 'integrations', 'gmail', 'configure'])
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

  it('prints informational message and exits 0 when google-calendar plugin is not registered', async () => {
    const program = new Command()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    registerCalendarAliasCommand(program)

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => {
      throw new Error(`process.exit(${_code})`)
    })

    await expect(
      program.parseAsync(['node', 'orbit', 'calendar']),
    ).rejects.toThrow('process.exit(0)')

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Google Calendar integration not enabled'),
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
