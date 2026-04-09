import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'

export function registerSchemaCommand(program: Command): void {
  const schema = program.command('schema').description('Inspect CRM schema and object definitions')

  schema
    .command('list')
    .description('List all registered object types')
    .action(async () => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.schema.response().listObjects()
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.listObjects()
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  schema
    .command('get <entity>')
    .description('Describe an object type and its custom fields')
    .action(async (entity) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.schema.response().describeObject(entity)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.describeObject(entity)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
