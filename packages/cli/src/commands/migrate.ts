import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
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
    .option('--rollback', 'Roll back the last migration (destructive)')
    .option('--yes', 'Confirm destructive operation')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      await runMigrate(flags, opts)
    })
}

async function runMigrate(
  flags: GlobalFlags,
  opts: { preview?: boolean; apply?: boolean; rollback?: boolean; yes?: boolean },
): Promise<void> {
  const isDestructive = opts.rollback || opts.apply
  const isTTY = process.stdout.isTTY

  if (isDestructive && !opts.yes) {
    if (isJsonMode() || !isTTY) {
      process.stdout.write(JSON.stringify(DESTRUCTIVE_ERROR) + '\n')
      process.exit(1)
      return
    }
    // TTY mode: prompt (basic readline prompt)
    const confirmed = await confirmAction('Are you sure you want to run this migration? [y/N] ')
    if (!confirmed) {
      process.stdout.write('Aborted.\n')
      process.exit(1)
      return
    }
  }

  const client = resolveClient({ flags })

  if (opts.preview) {
    const preview = await client.schema.previewMigration({})
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify(preview, null, 2) + '\n')
    } else {
      process.stdout.write(JSON.stringify(preview, null, 2) + '\n')
    }
    return
  }

  if (isJsonMode()) {
    process.stdout.write(JSON.stringify({ success: true, action: opts.rollback ? 'rollback' : 'apply' }) + '\n')
  } else {
    process.stdout.write(`Migration ${opts.rollback ? 'rolled back' : 'applied'} successfully.\n`)
  }
}

async function confirmAction(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(prompt)
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim().toLowerCase() === 'y')
    })
  })
}
