import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateCompanyInput, UpdateCompanyInput } from '@orbit-ai/sdk'

export function registerCompaniesCommand(program: Command): void {
  const companies = program.command('companies').description('Manage companies')

  companies
    .command('list')
    .description('List companies')
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
        const result = await client.companies.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.companies.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  companies
    .command('get <id>')
    .description('Get a company by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.companies.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.companies.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  companies
    .command('create')
    .description('Create a new company')
    .requiredOption('--name <name>', 'Company name')
    .option('--domain <domain>', 'Company domain')
    .option('--industry <industry>', 'Industry')
    .option('--size <size>', 'Company size')
    .option('--website <website>', 'Website URL')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateCompanyInput = { name: opts.name }
      if (opts.domain) input.domain = opts.domain
      if (opts.industry) input.industry = opts.industry
      if (opts.size) input.size = opts.size
      if (opts.website) input.website = opts.website

      if (flags.json) {
        const result = await client.companies.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.companies.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  companies
    .command('update <id>')
    .description('Update a company')
    .option('--name <name>', 'Company name')
    .option('--domain <domain>', 'Company domain')
    .option('--industry <industry>', 'Industry')
    .option('--size <size>', 'Company size')
    .option('--website <website>', 'Website URL')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateCompanyInput = {}
      if (opts.name) input.name = opts.name
      if (opts.domain) input.domain = opts.domain
      if (opts.industry) input.industry = opts.industry
      if (opts.size) input.size = opts.size
      if (opts.website) input.website = opts.website

      if (flags.json) {
        const result = await client.companies.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.companies.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  companies
    .command('delete <id>')
    .description('Delete a company')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.companies.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.companies.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
