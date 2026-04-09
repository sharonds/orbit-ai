import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { CliNotImplementedError } from '../errors.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'
import type { CreateContactInput, UpdateContactInput } from '@orbit-ai/sdk'

export function registerContactsCommand(program: Command): void {
  const contacts = program.command('contacts').description('Manage contacts')

  contacts
    .command('list')
    .description('List contacts')
    .option('--limit <n>', 'Max records', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })
      const query = {
        limit: Number(opts.limit),
        ...(opts.cursor ? { cursor: opts.cursor } : {}),
      }

      if (isJsonMode()) {
        const result = await client.contacts.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contacts.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  contacts
    .command('get <id>')
    .description('Get a contact by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.contacts.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contacts.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contacts
    .command('create')
    .description('Create a new contact')
    .requiredOption('--name <name>', 'Contact name')
    .option('--email <email>', 'Contact email')
    .option('--phone <phone>', 'Contact phone')
    .option('--title <title>', 'Contact title')
    .option('--source-channel <channel>', 'Source channel')
    .option('--status <status>', 'Contact status')
    .option('--company-id <id>', 'Company ID')
    .option('--assigned-to <userId>', 'Assigned to user ID')
    .option('--lead-score <n>', 'Lead score')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateContactInput = { name: opts.name }
      if (opts.email) input.email = opts.email
      if (opts.phone) input.phone = opts.phone
      if (opts.title) input.title = opts.title
      if (opts.sourceChannel) input.source_channel = opts.sourceChannel
      if (opts.status) input.status = opts.status
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.assignedTo) input.assigned_to_user_id = opts.assignedTo
      if (opts.leadScore !== undefined) input.lead_score = Number(opts.leadScore)

      if (isJsonMode()) {
        const result = await client.contacts.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contacts.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contacts
    .command('update <id>')
    .description('Update a contact')
    .option('--name <name>', 'Contact name')
    .option('--email <email>', 'Contact email')
    .option('--phone <phone>', 'Contact phone')
    .option('--title <title>', 'Contact title')
    .option('--source-channel <channel>', 'Source channel')
    .option('--status <status>', 'Contact status')
    .option('--company-id <id>', 'Company ID')
    .option('--assigned-to <userId>', 'Assigned to user ID')
    .option('--lead-score <n>', 'Lead score')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateContactInput = {}
      if (opts.name) input.name = opts.name
      if (opts.email) input.email = opts.email
      if (opts.phone) input.phone = opts.phone
      if (opts.title) input.title = opts.title
      if (opts.sourceChannel) input.source_channel = opts.sourceChannel
      if (opts.status) input.status = opts.status
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.assignedTo) input.assigned_to_user_id = opts.assignedTo
      if (opts.leadScore !== undefined) input.lead_score = Number(opts.leadScore)

      if (isJsonMode()) {
        const result = await client.contacts.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contacts.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contacts
    .command('delete <id>')
    .description('Delete a contact')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.contacts.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contacts.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contacts
    .command('import <file>')
    .description('Import contacts from CSV (requires file-upload seam in SDK)')
    .action(() => {
      throw new CliNotImplementedError(
        'orbit contacts import requires a file-upload seam that is not yet available in @orbit-ai/sdk.',
        { code: 'DEPENDENCY_NOT_AVAILABLE', dependency: 'sdk.imports.upload' },
      )
    })
}
