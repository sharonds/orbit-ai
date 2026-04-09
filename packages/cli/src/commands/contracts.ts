import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateContractInput, UpdateContractInput } from '@orbit-ai/sdk'

export function registerContractsCommand(program: Command): void {
  const contracts = program.command('contracts').description('Manage contracts')

  contracts
    .command('list')
    .description('List contracts')
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
        const result = await client.contracts.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contracts.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  contracts
    .command('get <id>')
    .description('Get a contract by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.contracts.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contracts.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contracts
    .command('create')
    .description('Create a new contract')
    .requiredOption('--title <title>', 'Contract title')
    .option('--status <status>', 'Contract status')
    .option('--value <value>', 'Contract value (number)')
    .option('--currency <currency>', 'Currency code (e.g. USD, EUR)')
    .option('--start-date <date>', 'Start date (ISO date)')
    .option('--end-date <date>', 'End date (ISO date)')
    .option('--deal-id <id>', 'Deal ID')
    .option('--contact-id <id>', 'Contact ID')
    .option('--company-id <id>', 'Company ID')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateContractInput = { title: opts.title }
      if (opts.status) input.status = opts.status
      if (opts.value !== undefined) input.value = Number(opts.value)
      if (opts.currency) input.currency = opts.currency
      if (opts.startDate) input.start_date = opts.startDate
      if (opts.endDate) input.end_date = opts.endDate
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId

      if (flags.json) {
        const result = await client.contracts.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contracts.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contracts
    .command('update <id>')
    .description('Update a contract')
    .option('--title <title>', 'Contract title')
    .option('--status <status>', 'Contract status')
    .option('--value <value>', 'Contract value (number)')
    .option('--currency <currency>', 'Currency code')
    .option('--start-date <date>', 'Start date (ISO date)')
    .option('--end-date <date>', 'End date (ISO date)')
    .option('--deal-id <id>', 'Deal ID')
    .option('--contact-id <id>', 'Contact ID')
    .option('--company-id <id>', 'Company ID')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateContractInput = {}
      if (opts.title) input.title = opts.title
      if (opts.status) input.status = opts.status
      if (opts.value !== undefined) input.value = Number(opts.value)
      if (opts.currency) input.currency = opts.currency
      if (opts.startDate) input.start_date = opts.startDate
      if (opts.endDate) input.end_date = opts.endDate
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.companyId) input.company_id = opts.companyId

      if (flags.json) {
        const result = await client.contracts.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contracts.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  contracts
    .command('delete <id>')
    .description('Delete a contract')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.contracts.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.contracts.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
