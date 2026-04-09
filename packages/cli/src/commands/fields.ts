import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import { confirmAction } from '../utils/prompt.js'
import type { GlobalFlags } from '../types.js'

const DESTRUCTIVE_FIELDS_DELETE_ERROR = (entity: string, fieldName: string) => ({
  error: {
    code: 'DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION',
    message: 'Use --yes to confirm this destructive action in non-interactive mode.',
    action: 'fields.delete',
    target: `${entity}.${fieldName}`,
  },
})

export function registerFieldsCommand(program: Command): void {
  const fields = program.command('fields').description('Manage custom fields')

  fields
    .command('list <entity>')
    .description('List custom fields for an entity type')
    .action(async (entity) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.schema.response().describeObject(entity)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.describeObject(entity)
        const fieldsData = result.customFields ?? []
        process.stdout.write(formatOutput({ data: fieldsData }, { format: flags.format ?? 'table' }))
      }
    })

  fields
    .command('create <entity>')
    .description('Add a custom field to an entity type')
    .requiredOption('--name <name>', 'Field name (snake_case)')
    .requiredOption('--type <type>', 'Field type (text, number, boolean, date, select)')
    .option('--label <label>', 'Display label')
    .option('--required', 'Mark field as required')
    .action(async (entity, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const body: Record<string, unknown> = {
        name: opts.name,
        type: opts.type,
      }
      if (opts.label) body.label = opts.label
      if (opts.required) body.required = true

      if (isJsonMode()) {
        const result = await client.schema.response().addField(entity, body)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.addField(entity, body)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  fields
    .command('delete <entity> <field-name>')
    .description('Delete a custom field from an entity type (destructive — requires --yes)')
    .option('--yes', 'Confirm destructive deletion')
    .action(async (entity, fieldName, opts) => {
      const flags = program.opts() as GlobalFlags
      const isTTY = process.stdout.isTTY

      // Resolve --yes from either the subcommand opts or the global flags
      const confirmed = opts.yes === true || flags.yes === true

      if (!confirmed) {
        if (isJsonMode() || !isTTY) {
          process.stdout.write(JSON.stringify(DESTRUCTIVE_FIELDS_DELETE_ERROR(entity, fieldName)) + '\n')
          process.exit(1)
          return
        }
        // TTY mode: prompt
        const ok = await confirmAction(
          `Are you sure you want to delete field '${fieldName}' from '${entity}'? [y/N] `,
        )
        if (!ok) {
          process.stdout.write('Aborted.\n')
          process.exit(1)
          return
        }
      }

      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.schema.response().deleteField(entity, fieldName)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.deleteField(entity, fieldName)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}

