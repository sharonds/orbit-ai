import { execa } from 'execa'
import {
  detectPackageManager,
  inferPackageManagerFromCommand,
  installCommandFor,
  parseInstallCmd,
  type PackageManager,
} from './packageManager.js'

export {
  detectPackageManager,
  inferPackageManagerFromCommand,
  installCommandFor,
  parseInstallCmd,
  type PackageManager,
} from './packageManager.js'

export const INSTALL_TIMEOUT_MS = 300_000

export interface RunInstallInput {
  readonly cwd: string
  readonly packageManager?: PackageManager
  readonly customCmd?: string
}

export async function runInstall(input: RunInstallInput): Promise<PackageManager> {
  const pm = input.packageManager ?? detectPackageManager(process.env)
  const commandPackageManager = input.customCmd ? inferPackageManagerFromCommand(input.customCmd) : undefined
  const [cmd, args] = input.customCmd
    ? parseInstallCmd(input.customCmd)
    : parseInstallCmd(installCommandFor(pm))
  try {
    await execa(cmd, args, { cwd: input.cwd, stdio: 'inherit', timeout: INSTALL_TIMEOUT_MS, shell: false })
  } catch (err) {
    if (isTimedOutError(err)) throw new Error('Install timed out after 5 minutes.')
    throw err
  }
  return commandPackageManager ?? pm
}

function isTimedOutError(err: unknown): err is { timedOut: true } {
  return typeof err === 'object' && err !== null && 'timedOut' in err && err.timedOut === true
}
