import { Command } from 'commander'
import { CliNotImplementedError } from '../errors.js'

export function registerReportCommand(program: Command): void {
  const report = program.command('report').description('Generate reports')

  report
    .command('summary')
    .description('Generate a CRM summary report (coming soon)')
    .action(() => {
      throw new CliNotImplementedError(
        'orbit report summary is not yet implemented. Reporting will be available in a future release.',
        { code: 'NOT_IMPLEMENTED', feature: 'reporting' },
      )
    })

  // Default action when no sub-command is given
  report.action(() => {
    throw new CliNotImplementedError(
      'orbit report is not yet implemented. Reporting will be available in a future release.',
      { code: 'NOT_IMPLEMENTED', feature: 'reporting' },
    )
  })
}
