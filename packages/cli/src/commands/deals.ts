import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'
import type { CreateDealInput, UpdateDealInput } from '@orbit-ai/sdk'

export function registerDealsCommand(program: Command): void {
  const deals = program.command('deals').description('Manage deals')

  deals
    .command('list')
    .description('List deals')
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
        const result = await client.deals.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.deals.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  deals
    .command('get <id>')
    .description('Get a deal by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.deals.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.deals.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  deals
    .command('create')
    .description('Create a new deal')
    .requiredOption('--name <name>', 'Deal name')
    .option('--value <n>', 'Deal value')
    .option('--currency <currency>', 'Currency code (e.g. USD, EUR)')
    .option('--stage-id <id>', 'Pipeline stage ID')
    .option('--pipeline-id <id>', 'Pipeline ID')
    .option('--contact-id <id>', 'Associated contact ID')
    .option('--company-id <id>', 'Associated company ID')
    .option('--assigned-to <userId>', 'Assigned to user ID')
    .option('--close-date <date>', 'Expected close date (ISO 8601)')
    .option('--status <status>', 'Deal status')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateDealInput = { name: opts.name }
      if (opts.value !== undefined) input.value = opts.value
      if (opts.currency) input.currency = opts.currency
      if (opts.stageId) input.stage_id = opts.stageId
      if (opts.pipelineId) input.pipeline_id = opts.pipelineId
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.assignedTo) input.assigned_to_user_id = opts.assignedTo
      if (opts.closeDate) input.expected_close_date = opts.closeDate
      if (opts.status) input.status = opts.status

      if (isJsonMode()) {
        const result = await client.deals.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.deals.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  deals
    .command('update <id>')
    .description('Update a deal')
    .option('--name <name>', 'Deal name')
    .option('--value <n>', 'Deal value')
    .option('--currency <currency>', 'Currency code')
    .option('--stage-id <id>', 'Pipeline stage ID')
    .option('--pipeline-id <id>', 'Pipeline ID')
    .option('--contact-id <id>', 'Associated contact ID')
    .option('--company-id <id>', 'Associated company ID')
    .option('--assigned-to <userId>', 'Assigned to user ID')
    .option('--close-date <date>', 'Expected close date (ISO 8601)')
    .option('--status <status>', 'Deal status')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateDealInput = {}
      if (opts.name) input.name = opts.name
      if (opts.value !== undefined) input.value = opts.value
      if (opts.currency) input.currency = opts.currency
      if (opts.stageId) input.stage_id = opts.stageId
      if (opts.pipelineId) input.pipeline_id = opts.pipelineId
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId
      if (opts.assignedTo) input.assigned_to_user_id = opts.assignedTo
      if (opts.closeDate) input.expected_close_date = opts.closeDate
      if (opts.status) input.status = opts.status

      if (isJsonMode()) {
        const result = await client.deals.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.deals.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  deals
    .command('delete <id>')
    .description('Delete a deal')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.deals.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.deals.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  deals
    .command('move <id>')
    .description('Move a deal to a different pipeline stage')
    .requiredOption('--stage-id <id>', 'Target stage ID')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.deals.response().move(id, { stage_id: opts.stageId })
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.deals.move(id, { stage_id: opts.stageId })
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
