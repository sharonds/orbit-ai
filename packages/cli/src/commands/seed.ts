import { Command } from 'commander'
import { loadConfig } from '../config/files.js'
import { resolveClient } from '../config/resolve-context.js'
import { CliValidationError } from '../errors.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'

export function registerSeedCommand(program: Command): void {
  program
    .command('seed')
    .description('Seed the database with example data (direct mode only)')
    .option('--count <n>', 'Number of example records to create', '5')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const count = Number(opts.count)
      if (!Number.isInteger(count) || count < 1 || count > 1000) {
        throw new CliValidationError(
          `--count must be a positive integer between 1 and 1000, got: '${opts.count}'`,
          { code: 'INVALID_ARGUMENT', path: 'count' },
        )
      }
      await runSeed(flags, count, process.cwd())
    })
}

async function runSeed(flags: GlobalFlags, count: number, cwd?: string): Promise<void> {
  // Resolve effective mode: flag > config file > default 'api'
  // Pass cwd so resolution matches what resolveClient will use (avoids divergence in tests)
  const fileConfig = loadConfig(cwd)
  const effectiveMode = flags.mode ?? fileConfig.mode ?? 'api'

  if (effectiveMode !== 'direct') {
    const msg = 'orbit seed requires direct mode (--mode direct with a local adapter)'
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify({ error: { code: 'DIRECT_MODE_REQUIRED', message: msg } }) + '\n')
    } else {
      process.stderr.write(msg + '\n')
    }
    process.exit(2)
    return
  }

  const client = resolveClient({ flags })
  const created: unknown[] = []

  try {
    for (let i = 0; i < count; i++) {
      const contact = await client.contacts.create({ name: `Seed ${i + 1}`, email: `seed${i + 1}@example.com` })
      created.push(contact)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify({
        seeded: created.length,
        total: count,
        error: { code: 'SEED_PARTIAL_FAILURE', message: msg },
      }) + '\n')
    } else {
      process.stderr.write(`Seeded ${created.length}/${count} contacts before error: ${msg}\n`)
    }
    process.exit(1)
  }

  if (isJsonMode()) {
    process.stdout.write(JSON.stringify({ seeded: created.length }) + '\n')
  } else {
    process.stdout.write(`Seeded ${created.length} contacts.\n`)
  }
}
