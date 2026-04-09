import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreatePipelineInput, UpdatePipelineInput } from '@orbit-ai/sdk'

export function registerPipelinesCommand(program: Command): void {
  const pipelines = program.command('pipelines').description('Manage pipelines')

  pipelines
    .command('list')
    .description('List pipelines')
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
        const result = await client.pipelines.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.pipelines.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  pipelines
    .command('get <id>')
    .description('Get a pipeline by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.pipelines.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.pipelines.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  pipelines
    .command('create')
    .description('Create a new pipeline')
    .requiredOption('--name <name>', 'Pipeline name')
    .option('--description <description>', 'Pipeline description')
    .option('--default', 'Set as default pipeline')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreatePipelineInput = { name: opts.name }
      if (opts.description) input.description = opts.description
      if (opts.default) input.is_default = true

      if (flags.json) {
        const result = await client.pipelines.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.pipelines.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  pipelines
    .command('update <id>')
    .description('Update a pipeline')
    .option('--name <name>', 'Pipeline name')
    .option('--description <description>', 'Pipeline description')
    .option('--default', 'Set as default pipeline')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdatePipelineInput = {}
      if (opts.name) input.name = opts.name
      if (opts.description) input.description = opts.description
      if (opts.default) input.is_default = true

      if (flags.json) {
        const result = await client.pipelines.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.pipelines.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  pipelines
    .command('delete <id>')
    .description('Delete a pipeline')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.pipelines.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.pipelines.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
