import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateStageInput, UpdateStageInput } from '@orbit-ai/sdk'

export function registerStagesCommand(program: Command): void {
  const stages = program.command('stages').description('Manage pipeline stages')

  stages
    .command('list')
    .description('List stages')
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
        const result = await client.stages.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.stages.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  stages
    .command('get <id>')
    .description('Get a stage by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.stages.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.stages.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  stages
    .command('create')
    .description('Create a new stage')
    .requiredOption('--pipeline-id <id>', 'Pipeline ID')
    .requiredOption('--name <name>', 'Stage name')
    .option('--position <n>', 'Stage position')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateStageInput = { pipeline_id: opts.pipelineId, name: opts.name }
      if (opts.position !== undefined) input.position = Number(opts.position)

      if (flags.json) {
        const result = await client.stages.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.stages.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  stages
    .command('update <id>')
    .description('Update a stage')
    .option('--name <name>', 'Stage name')
    .option('--position <n>', 'Stage position')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateStageInput = {}
      if (opts.name) input.name = opts.name
      if (opts.position !== undefined) input.position = Number(opts.position)

      if (flags.json) {
        const result = await client.stages.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.stages.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  stages
    .command('delete <id>')
    .description('Delete a stage')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.stages.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.stages.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
