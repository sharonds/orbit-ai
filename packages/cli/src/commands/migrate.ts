import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { CliValidationError } from '../errors.js'
import { isJsonMode } from '../program.js'
import { confirmAction } from '../utils/prompt.js'
import type { GlobalFlags } from '../types.js'

const DESTRUCTIVE_ERROR = {
  error: {
    code: 'DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION',
    message: 'Use --yes to confirm this destructive action in non-interactive mode.',
    action: 'migrate',
  },
}

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Run schema migrations')
    .option('--preview', 'Preview migration operations')
    .option('--apply', 'Apply migration operations')
    .option('--rollback', 'Roll back the migration specified by --id (destructive)')
    .option('--id <id>', 'Migration ID required for --rollback')
    .option('--operations <json>', 'Migration operations JSON array, or JSON object with an operations array')
    .option('--checksum <checksum>', 'Expected checksum for rollback confirmation')
    .option('--yes', 'Confirm destructive operation')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      await runMigrate(flags, opts)
    })
}

async function runMigrate(
  flags: GlobalFlags,
  opts: {
    preview?: boolean
    apply?: boolean
    rollback?: boolean
    id?: string
    operations?: string
    checksum?: string
    yes?: boolean
  },
): Promise<void> {
  if (!opts.preview && !opts.apply && !opts.rollback) {
    throw new CliValidationError(
      'orbit migrate requires --preview, --apply, or --rollback.',
      { code: 'MISSING_REQUIRED_ARG', path: 'subcommand' },
    )
  }

  // Only --rollback is always destructive (no preview step)
  const isDefinitelyDestructive = opts.rollback
  const isTTY = process.stdout.isTTY
  let confirmed = opts.yes === true || flags.yes === true

  if (isDefinitelyDestructive && !confirmed) {
    if (isJsonMode() || !isTTY) {
      process.stdout.write(JSON.stringify(DESTRUCTIVE_ERROR) + '\n')
      process.exit(1)
      return
    }
    const ok = await confirmAction('Are you sure you want to run this migration? [y/N] ')
    if (!ok) {
      process.stdout.write('Aborted.\n')
      process.exit(1)
      return
    }
    confirmed = true
  }

  const client = resolveClient({ flags })

  if (opts.preview) {
    const preview = await client.schema.previewMigration(parseOperationsRequest(opts.operations))
    process.stdout.write(JSON.stringify(preview, null, 2) + '\n')
    return
  }

  if (opts.apply) {
    // Preview first to detect destructive operations
    const preview = await client.schema.previewMigration(parseOperationsRequest(opts.operations))
    // Rely only on the explicit destructive flag — regex matching on serialised JSON
    // causes false positives for field names or descriptions containing "drop"/"rename"
    const hasDestructive = isDestructivePreview(preview)

    if (hasDestructive && !confirmed) {
      if (isJsonMode() || !isTTY) {
        process.stdout.write(
          JSON.stringify({
            ...DESTRUCTIVE_ERROR,
            error: { ...DESTRUCTIVE_ERROR.error, preview },
          }) + '\n',
        )
        process.exit(1)
        return
      }
      const ok = await confirmAction(
        'This migration contains destructive operations. Confirm? [y/N] ',
      )
      if (!ok) {
        process.stdout.write('Aborted.\n')
        process.exit(1)
        return
      }
      confirmed = true
    }

    const operations = readPreviewOperations(preview)
    const checksum = readPreviewChecksum(preview)
    const result = await client.schema.applyMigration({
      operations,
      checksum,
      ...(hasDestructive && confirmed ? { confirmation: makeConfirmation(checksum) } : {}),
    })
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } else {
      process.stdout.write(`Migration applied:\n${JSON.stringify(result, null, 2)}\n`)
    }
    return
  }

  if (opts.rollback) {
    if (!opts.id) {
      throw new CliValidationError('--rollback requires --id <migration-id>', {
        code: 'MISSING_REQUIRED_ARG',
        path: 'id',
      })
    }
    if (confirmed && !opts.checksum) {
      throw new CliValidationError('--rollback --yes requires --checksum <checksum>', {
        code: 'MISSING_REQUIRED_ARG',
        path: 'checksum',
      })
    }
    const body = opts.checksum
      ? {
          checksum: opts.checksum,
          ...(confirmed ? { confirmation: makeConfirmation(opts.checksum) } : {}),
        }
      : undefined
    const result = await client.schema.rollbackMigration(opts.id, body)
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } else {
      process.stdout.write(`Migration ${opts.id} rolled back:\n${JSON.stringify(result, null, 2)}\n`)
    }
    return
  }
}

function parseOperationsRequest(value: string | undefined): { operations: unknown[] } {
  if (!value) {
    throw new CliValidationError('orbit migrate requires --operations <json> for --preview and --apply.', {
      code: 'MISSING_REQUIRED_ARG',
      path: 'operations',
    })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new CliValidationError('--operations must be valid JSON.', {
      code: 'INVALID_JSON',
      path: 'operations',
    })
  }

  const operations = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { operations?: unknown }).operations)
      ? (parsed as { operations: unknown[] }).operations
      : null

  if (!operations) {
    throw new CliValidationError('--operations must be a JSON array or an object with an operations array.', {
      code: 'INVALID_ARG',
      path: 'operations',
    })
  }

  return { operations }
}

function isDestructivePreview(preview: Record<string, unknown>): boolean {
  return preview.destructive === true || preview.confirmationRequired === true
}

function readPreviewOperations(preview: Record<string, unknown>): unknown[] {
  if (!Array.isArray(preview.operations)) {
    throw new CliValidationError('Migration preview did not include operations.', {
      code: 'INVALID_MIGRATION_PREVIEW',
      path: 'operations',
    })
  }
  return preview.operations
}

function readPreviewChecksum(preview: Record<string, unknown>): string {
  if (typeof preview.checksum !== 'string') {
    throw new CliValidationError('Migration preview did not include a checksum.', {
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
