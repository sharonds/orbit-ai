import { Command } from 'commander'
import { isJsonMode } from '../program.js'

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run environment diagnostics')
    .action(async () => {
      await runDoctor()
    })
}

async function runDoctor(): Promise<void> {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = []

  // Node.js version
  const nodeVersion = process.versions.node
  const majorStr = nodeVersion.split('.')[0]
  const major = majorStr !== undefined ? Number(majorStr) : 0
  checks.push({
    name: 'Node.js version >= 20',
    pass: major >= 20,
    detail: `v${nodeVersion}`,
  })

  // ORBIT_API_KEY env
  checks.push({
    name: 'ORBIT_API_KEY set',
    pass: !!process.env.ORBIT_API_KEY,
  })

  if (isJsonMode()) {
    process.stdout.write(JSON.stringify({ checks }) + '\n')
  } else {
    for (const check of checks) {
      const icon = check.pass ? '✓' : '✗'
      process.stdout.write(`${icon} ${check.name}${check.detail ? ` (${check.detail})` : ''}\n`)
    }
  }
}
