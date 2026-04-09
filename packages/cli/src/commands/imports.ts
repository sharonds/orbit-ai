import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'

export function registerImportsCommand(program: Command): void {
  const imports = program.command('imports').description('Manage data imports (metadata only — no file upload)')

  imports
    .command('list')
    .description('List imports')
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
        const result = await client.imports.list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.imports.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  imports
    .command('get <id>')
    .description('Get an import by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.imports.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.imports.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  imports
    .command('create')
    .description('Create an import record (metadata only — no file upload)')
    .requiredOption('--entity-type <type>', 'Entity type to import (e.g. contacts, companies)')
    .option('--status <status>', 'Import status')
    .option('--total-rows <n>', 'Expected total rows')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input = {
        entity_type: opts.entityType,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.totalRows !== undefined ? { total_rows: Number(opts.totalRows) } : {}),
      }

      if (flags.json) {
        const result = await client.imports.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.imports.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
