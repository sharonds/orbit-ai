import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateNoteInput, UpdateNoteInput } from '@orbit-ai/sdk'

export function registerNotesCommand(program: Command): void {
  const notes = program.command('notes').description('Manage notes')

  notes
    .command('list')
    .description('List notes')
    .option('--limit <n>', 'Max records', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })
      const query = {
        limit: Number(opts.limit),
        ...(opts.cursor ? { cursor: opts.cursor } : {}),
      }

      if (flags.json) {
        const result = await client.notes.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.notes.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  notes
    .command('get <id>')
    .description('Get a note by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.notes.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.notes.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  notes
    .command('create')
    .description('Create a new note')
    .requiredOption('--body <body>', 'Note body text')
    .option('--contact-id <id>', 'Contact ID')
    .option('--company-id <id>', 'Company ID')
    .option('--deal-id <id>', 'Deal ID')
    .option('--user-id <id>', 'User ID')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateNoteInput = { body: opts.body }
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.userId) input.user_id = opts.userId

      if (flags.json) {
        const result = await client.notes.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.notes.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  notes
    .command('update <id>')
    .description('Update a note')
    .option('--body <body>', 'Note body text')
    .option('--contact-id <id>', 'Contact ID')
    .option('--company-id <id>', 'Company ID')
    .option('--deal-id <id>', 'Deal ID')
    .option('--user-id <id>', 'User ID')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateNoteInput = {}
      if (opts.body) input.body = opts.body
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.userId) input.user_id = opts.userId

      if (flags.json) {
        const result = await client.notes.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.notes.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  notes
    .command('delete <id>')
    .description('Delete a note')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.notes.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.notes.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
