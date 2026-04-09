import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { CliValidationError } from '../errors.js'
import type { GlobalFlags } from '../types.js'

export function registerContextCommand(program: Command): void {
  program
    .command('context <idOrEmail>')
    .description('Show full CRM context for a contact (by ID or email)')
    .action(async (idOrEmail) => {
      const flags = program.opts() as GlobalFlags

      if (!idOrEmail || idOrEmail.trim() === '') {
        throw new CliValidationError(
          'A contact ID or email address is required.',
          { code: 'MISSING_REQUIRED_ARG', path: 'idOrEmail' },
        )
      }

      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.contacts.response().context(idOrEmail)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contacts.context(idOrEmail)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
