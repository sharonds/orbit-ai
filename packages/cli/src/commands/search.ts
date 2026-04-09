import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { CliValidationError } from '../errors.js'
import type { GlobalFlags } from '../types.js'
import type { SearchInput } from '@orbit-ai/sdk'

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search across CRM entities')
    .option('--types <types>', 'Comma-separated object types to search (e.g. contacts,deals)')
    .option('--limit <n>', 'Max results', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (query, opts) => {
      const flags = program.opts() as GlobalFlags

      if (!query || query.trim() === '') {
        throw new CliValidationError(
          'A search query is required.',
          { code: 'MISSING_REQUIRED_ARG', path: 'query' },
        )
      }

      const client = resolveClient({ flags })

      const input: SearchInput = { query }
      if (opts.types) {
        input.object_types = opts.types.split(',').map((t: string) => t.trim()).filter(Boolean)
      }
      if (opts.limit !== undefined) input.limit = Number(opts.limit)
      if (opts.cursor) input.cursor = opts.cursor

      if (flags.json) {
        const result = await client.search.response().query(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.search.query(input)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })
}
