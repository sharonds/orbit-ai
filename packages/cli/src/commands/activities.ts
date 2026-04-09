import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'
import type { CreateActivityInput, UpdateActivityInput } from '@orbit-ai/sdk'

export function registerActivitiesCommand(program: Command): void {
  const activities = program.command('activities').description('Manage activities')

  activities
    .command('list')
    .description('List activities')
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
        const result = await client.activities.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.activities.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  activities
    .command('get <id>')
    .description('Get an activity by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.activities.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.activities.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  activities
    .command('create')
    .description('Create a new activity')
    .requiredOption('--type <type>', 'Activity type (call, email, meeting, note, task)')
    .option('--subject <subject>', 'Activity subject')
    .option('--description <description>', 'Activity description')
    .option('--contact-id <id>', 'Contact ID')
    .option('--company-id <id>', 'Company ID')
    .option('--deal-id <id>', 'Deal ID')
    .option('--user-id <id>', 'User ID')
    .option('--occurred-at <date>', 'Occurred at (ISO date)')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateActivityInput = { type: opts.type }
      if (opts.subject) input.subject = opts.subject
      if (opts.description) input.description = opts.description
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.userId) input.user_id = opts.userId
      if (opts.occurredAt) input.occurred_at = opts.occurredAt

      if (isJsonMode()) {
        const result = await client.activities.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.activities.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  activities
    .command('update <id>')
    .description('Update an activity')
    .option('--type <type>', 'Activity type')
    .option('--subject <subject>', 'Activity subject')
    .option('--description <description>', 'Activity description')
    .option('--contact-id <id>', 'Contact ID')
    .option('--company-id <id>', 'Company ID')
    .option('--deal-id <id>', 'Deal ID')
    .option('--user-id <id>', 'User ID')
    .option('--occurred-at <date>', 'Occurred at (ISO date)')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateActivityInput = {}
      if (opts.type) input.type = opts.type
      if (opts.subject) input.subject = opts.subject
      if (opts.description) input.description = opts.description
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.userId) input.user_id = opts.userId
      if (opts.occurredAt) input.occurred_at = opts.occurredAt

      if (isJsonMode()) {
        const result = await client.activities.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.activities.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  activities
    .command('delete <id>')
    .description('Delete an activity')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.activities.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.activities.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
