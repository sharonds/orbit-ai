import { describe, it, expect } from 'vitest'
import { Command } from 'commander'
import { registerIntegrationSubcommands } from './integrations.js'

describe('registerIntegrationSubcommands', () => {
  it('registers a nested provider/command path when name includes a slash', () => {
    const program = new Command()
    registerIntegrationSubcommands(program, [
      { name: 'gmail/configure', description: 'Configure Gmail', action: () => {} },
      { name: 'gmail/status', description: 'Gmail status', action: () => {} },
      { name: 'google-calendar/configure', description: 'Configure Calendar', action: () => {} },
    ])
    const integrations = program.commands.find((c) => c.name() === 'integrations')!
    const gmail = integrations.commands.find((c) => c.name() === 'gmail')!
    expect(gmail).toBeDefined()
    expect(gmail.commands.find((c) => c.name() === 'configure')).toBeDefined()
    expect(gmail.commands.find((c) => c.name() === 'status')).toBeDefined()
    const cal = integrations.commands.find((c) => c.name() === 'google-calendar')!
    expect(cal.commands.find((c) => c.name() === 'configure')).toBeDefined()
  })

  it('still supports flat names (backwards compatible)', () => {
    const program = new Command()
    registerIntegrationSubcommands(program, [
      { name: 'legacy-flat', description: 'legacy', action: () => {} },
    ])
    const integrations = program.commands.find((c) => c.name() === 'integrations')!
    expect(integrations.commands.find((c) => c.name() === 'legacy-flat')).toBeDefined()
  })
})
