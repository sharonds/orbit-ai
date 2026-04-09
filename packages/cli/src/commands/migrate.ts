import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { CliValidationError } from '../errors.js'
import { isJsonMode } from '../program.js'
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
    .option('--preview', 'Preview pending migrations')
    .option('--apply', 'Apply pending migrations')
    .option('--rollback', 'Roll back the migration specified by --id (destructive)')
    .option('--id <id>', 'Migration ID required for --rollback')
    .option('--yes', 'Confirm destructive operation')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      await runMigrate(flags, opts)
    })
}

async function runMigrate(
  flags: GlobalFlags,
  opts: { preview?: boolean; apply?: boolean; rollback?: boolean; id?: string; yes?: boolean },
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
  const confirmed = opts.yes === true || flags.yes === true

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
  }

  const client = resolveClient({ flags })

  if (opts.preview) {
    const preview = await client.schema.previewMigration({})
    process.stdout.write(JSON.stringify(preview, null, 2) + '\n')
    return
  }

  if (opts.apply) {
    // Preview first to detect destructive operations
    const preview = await client.schema.previewMigration({})
    // Rely only on the explicit destructive flag — regex matching on serialised JSON
    // causes false positives for field names or descriptions containing "drop"/"rename"
    const hasDestructive =
      typeof (preview as { destructive?: boolean }).destructive === 'boolean'
        ? (preview as { destructive?: boolean }).destructive
        : false

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
    }

    const result = await client.schema.applyMigration({})
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
    const result = await client.schema.rollbackMigration(opts.id)
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } else {
      process.stdout.write(`Migration ${opts.id} rolled back:\n${JSON.stringify(result, null, 2)}\n`)
    }
    return
  }
}

async function confirmAction(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stderr.write(prompt)
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim().toLowerCase() === 'y')
    })
  })
}
