import { Command } from 'commander'

export interface IntegrationCommand {
  name: string
  description: string
  action: (...args: unknown[]) => void | Promise<void>
  options?: Array<{ flags: string; description: string; defaultValue?: string | boolean }>
}

/**
 * Find or create the 'integrations' parent command on a program.
 * Returns the existing command if already registered.
 */
function findOrCreateIntegrationsParent(program: Command): Command {
  const existing = program.commands.find((c) => c.name() === 'integrations')
  if (existing) return existing
  return program
    .command('integrations')
    .description('Manage integrations (Gmail, Google Calendar, Stripe)')
}

/**
 * Register an array of integration plugins as subcommands under `orbit integrations`.
 * Safe to call with an empty array — the parent command is still registered with no subcommands.
 */
export function registerIntegrationSubcommands(program: Command, plugins: IntegrationCommand[]): void {
  const parent = findOrCreateIntegrationsParent(program)

  for (const plugin of plugins) {
    const sub = parent.command(plugin.name).description(plugin.description)

    if (plugin.options) {
      for (const opt of plugin.options) {
        if (opt.defaultValue !== undefined) {
          sub.option(
            opt.flags,
            opt.description,
            typeof opt.defaultValue === 'boolean' ? opt.defaultValue : String(opt.defaultValue),
          )
        } else {
          sub.option(opt.flags, opt.description)
        }
      }
    }

    sub.action(plugin.action)
  }
}

/**
 * Register the `integrations` parent command on the program.
 * Acts as a thin wrapper; does not throw if no plugins are loaded.
 */
export function registerIntegrationsCommand(program: Command): void {
  findOrCreateIntegrationsParent(program)
}
