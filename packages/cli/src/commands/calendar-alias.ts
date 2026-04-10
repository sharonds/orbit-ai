import { Command } from 'commander'

/**
 * Register a top-level `calendar` alias for `orbit integrations google-calendar`.
 *
 * If the google-calendar integration is not loaded (no subcommand registered),
 * the alias prints an informational message instead of failing.
 */
export function registerCalendarAliasCommand(program: Command): void {
  program
    .command('calendar', { hidden: false })
    .description('Alias for `orbit integrations google-calendar`')
    .allowUnknownOption(true)
    .action(function (this: Command) {
      const integrationsCmd = program.commands.find((c) => c.name() === 'integrations')
      const calendarCmd = integrationsCmd?.commands.find((c) => c.name() === 'google-calendar')

      if (!calendarCmd) {
        process.stderr.write(
          'Google Calendar integration not enabled. Install @orbit-ai/integrations and register the google-calendar plugin.\n',
        )
        process.exit(0)
        return
      }

      // Forward remaining args to the google-calendar subcommand
      const remaining = this.args
      calendarCmd.parseAsync(['node', 'orbit'].concat(remaining), { from: 'user' }).catch((err: unknown) => {
        process.stderr.write(
          `calendar alias error: ${err instanceof Error ? err.message : String(err)}\n`,
        )
        process.exit(1)
      })
    })
}
