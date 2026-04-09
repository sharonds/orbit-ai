import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show connection and config status')
    .action(async () => {
      const flags = program.opts() as GlobalFlags
      await runStatus(flags)
    })
}

async function runStatus(flags: GlobalFlags): Promise<void> {
  const client = resolveClient({ flags })
  // Try a lightweight call — list users with limit 1
  try {
    await client.users.list({ limit: 1 })
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify({ status: 'ok', connected: true }) + '\n')
    } else {
      process.stdout.write('Status: connected\n')
    }
  } catch (e) {
    // Re-throw so run()'s top-level handler applies the standard { error: ... } contract.
    throw e
  }
}
