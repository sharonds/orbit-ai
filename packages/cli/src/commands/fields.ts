import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { CliValidationError } from '../errors.js'
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

const destructiveFieldsError = (
  action: 'fields.delete' | 'fields.update',
  entity: string,
  fieldName: string,
  preview?: Record<string, unknown>,
) => ({
  error: {
    code: 'DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION',
    message: 'Use --yes to confirm this destructive action in non-interactive mode.',
    action,
    target: `${entity}.${fieldName}`,
    ...(preview ? { preview } : {}),
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
      const preview = await client.schema.previewMigration({
        operations: [deleteFieldOperation(entity, fieldName)],
      })
      const body = { confirmation: makeConfirmation(readPreviewChecksum(preview)) }

      if (isJsonMode()) {
        const result = await client.schema.response().deleteField(entity, fieldName, body)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.deleteField(entity, fieldName, body)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  fields
    .command('update <entity> <field-name>')
    .description('Update a custom field on an entity type')
    .option('--label <label>', 'Display label')
    .option('--description <description>', 'Field description')
    .option('--type <type>', 'Field type (text, number, boolean, date, select)')
    .option('--required', 'Mark field as required')
    .option('--no-required', 'Mark field as optional')
    .option('--indexed', 'Mark field as indexed')
    .option('--no-indexed', 'Mark field as not indexed')
    .option('--default-value <json>', 'Default value as JSON')
    .option('--options <json>', 'Select options as a JSON array')
    .option('--validation <json>', 'Validation object as JSON')
    .option('--yes', 'Confirm destructive update')
    .action(async (entity, fieldName, opts) => {
      const flags = program.opts() as GlobalFlags
      const isTTY = process.stdout.isTTY
      let confirmed = opts.yes === true || flags.yes === true
      const patch = buildUpdatePatch(opts)
      const operation = {
        type: 'custom_field.update',
        entityType: entity,
        fieldName,
        patch,
      }

      const client = resolveClient({ flags })
      const preview = await client.schema.previewMigration({ operations: [operation] })
      const destructive = isDestructivePreview(preview)

      if (destructive && !confirmed) {
        if (isJsonMode() || !isTTY) {
          process.stdout.write(
            JSON.stringify(destructiveFieldsError('fields.update', entity, fieldName, preview)) + '\n',
          )
          process.exit(1)
          return
        }
        const ok = await confirmAction(
          `This update may destructively change field '${fieldName}' on '${entity}'. Confirm? [y/N] `,
        )
        if (!ok) {
          process.stdout.write('Aborted.\n')
          process.exit(1)
          return
        }
        confirmed = true
      }

      const body = {
        ...patch,
        ...(destructive && confirmed ? { confirmation: makeConfirmation(readPreviewChecksum(preview)) } : {}),
      }

      if (isJsonMode()) {
        const result = await client.schema.response().updateField(entity, fieldName, body)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.schema.updateField(entity, fieldName, body)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}

function deleteFieldOperation(entity: string, fieldName: string) {
  return {
    type: 'custom_field.delete',
    entityType: entity,
    fieldName,
  }
}

function buildUpdatePatch(opts: {
  label?: string
  description?: string
  type?: string
  required?: boolean
  indexed?: boolean
  defaultValue?: string
  options?: string
  validation?: string
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (opts.label !== undefined) patch.label = opts.label
  if (opts.description !== undefined) patch.description = opts.description
  if (opts.type !== undefined) patch.fieldType = opts.type
  if (opts.required !== undefined) patch.required = opts.required
  if (opts.indexed !== undefined) patch.indexed = opts.indexed
  if (opts.defaultValue !== undefined) patch.defaultValue = parseJsonOption(opts.defaultValue, 'default-value')
  if (opts.options !== undefined) patch.options = parseJsonOption(opts.options, 'options')
  if (opts.validation !== undefined) patch.validation = parseJsonOption(opts.validation, 'validation')

  if (Object.keys(patch).length === 0) {
    throw new CliValidationError('fields update requires at least one field option.', {
      code: 'MISSING_REQUIRED_ARG',
      path: 'field',
    })
  }

  return patch
}

function parseJsonOption(value: string, option: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    throw new CliValidationError(`--${option} must be valid JSON.`, {
      code: 'INVALID_JSON',
      path: option,
    })
  }
}

function isDestructivePreview(preview: Record<string, unknown>): boolean {
  return preview.destructive === true || preview.confirmationRequired === true
}

function readPreviewChecksum(preview: Record<string, unknown>): string {
  if (typeof preview.checksum !== 'string') {
    throw new CliValidationError('Schema migration preview did not include a checksum.', {
      code: 'INVALID_MIGRATION_PREVIEW',
      path: 'checksum',
    })
  }
  return preview.checksum
}

function makeConfirmation(checksum: string) {
  return {
    destructive: true as const,
    checksum,
    confirmedAt: new Date().toISOString(),
  }
}
