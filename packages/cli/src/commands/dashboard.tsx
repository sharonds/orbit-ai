import React from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import { Dashboard } from '../ink/dashboard.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Interactive CRM dashboard')
    .action(() => {
      // Guard: non-interactive or JSON mode — must be checked synchronously
      if (isJsonMode() || !process.stdout.isTTY) {
        if (isJsonMode()) {
          process.stdout.write(
            JSON.stringify({
              error: {
                code: 'INTERACTIVE_REQUIRED',
                message: 'dashboard requires a TTY. Use --json for machine output.',
              },
            }) + '\n',
          )
        }
        process.exit(1)
        return
      }

      render(<Dashboard />)
    })
}
