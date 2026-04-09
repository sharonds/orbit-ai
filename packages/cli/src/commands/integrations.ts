import { Command } from 'commander'
import { CliNotImplementedError } from '../errors.js'

export function registerIntegrationsCommand(program: Command): void {
  program
    .command('integrations')
    .description('Integration commands (coming soon)')
    .allowUnknownOption(true)
    .action(() => {
      throw new CliNotImplementedError(
        'orbit integrations requires @orbit-ai/integrations which is not yet available.',
        { code: 'DEPENDENCY_NOT_AVAILABLE', dependency: '@orbit-ai/integrations' },
      )
    })
}
