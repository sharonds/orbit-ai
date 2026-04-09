import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateActivityInput } from '@orbit-ai/sdk'

export function registerLogCommand(program: Command): void {
  program
    .command('log <type>')
    .description('Log an activity (call, email, meeting, note, task)')
    .option('--contact <id>', 'Contact ID')
    .option('--company <id>', 'Company ID')
    .option('--deal <id>', 'Deal ID')
    .option('--note <text>', 'Note text / description')
    .option('--subject <subject>', 'Activity subject')
    .option('--occurred-at <date>', 'Occurred at (ISO date)')
    .action(async (type, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const body: CreateActivityInput = { type }
      if (opts.contact) body.contact_id = opts.contact
      if (opts.company) body.company_id = opts.company
      if (opts.deal) body.deal_id = opts.deal
      if (opts.note) body.description = opts.note
      if (opts.subject) body.subject = opts.subject
      if (opts.occurredAt) body.occurred_at = opts.occurredAt

      const result = await client.activities.log(body)

      if (flags.json) {
        process.stdout.write(JSON.stringify({ data: result }, null, 2) + '\n')
      } else {
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
