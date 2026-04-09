import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'

export function registerSeedCommand(program: Command): void {
  program
    .command('seed')
    .description('Seed the database with example data (direct mode only)')
    .option('--count <n>', 'Number of example records to create', '5')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      await runSeed(flags, Number(opts.count))
    })
}

async function runSeed(flags: GlobalFlags, count: number): Promise<void> {
  if (flags.mode !== 'direct') {
    const msg = 'orbit seed requires direct mode (--mode direct with a local adapter)'
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify({ error: { code: 'DIRECT_MODE_REQUIRED', message: msg } }) + '\n')
    } else {
      process.stderr.write(msg + '\n')
    }
    process.exit(2)
  }

  const client = resolveClient({ flags })
  const created: unknown[] = []

  for (let i = 0; i < count; i++) {
    const contact = await client.contacts.create({
      name: `Seed${i + 1} Contact`,
      email: `seed${i + 1}@example.com`,
    })
    created.push(contact)
  }

  if (isJsonMode()) {
    process.stdout.write(JSON.stringify({ seeded: created.length }) + '\n')
  } else {
    process.stdout.write(`Seeded ${created.length} contacts.\n`)
  }
}
