import { execa } from 'execa'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export const INSTALL_TIMEOUT_MS = 300_000

export function detectPackageManager(env: NodeJS.ProcessEnv): PackageManager {
  const ua = env.npm_config_user_agent ?? ''
  if (ua.startsWith('pnpm/')) return 'pnpm'
  if (ua.startsWith('yarn/')) return 'yarn'
  if (ua.startsWith('bun/')) return 'bun'
  return 'npm'
}

export function parseInstallCmd(cmd: string): [string, string[]] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined
  let tokenStarted = false

  for (const char of cmd.trim()) {
    if (quote) {
      if (char === quote) {
        quote = undefined
      } else {
        current += char
      }
      tokenStarted = true
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      tokenStarted = true
      continue
    }

    if (/\s/.test(char)) {
      if (tokenStarted) {
        parts.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += char
    tokenStarted = true
  }

  if (quote) throw new Error('Unterminated quote in install command')
  if (tokenStarted) parts.push(current)
  if (parts.length === 0 || !parts[0]) throw new Error('Empty install command')
  return [parts[0], parts.slice(1)]
}

export function inferPackageManagerFromCommand(cmd: string): PackageManager | undefined {
  const [binary] = parseInstallCmd(cmd)
  const name = binary.split(/[\\/]/).pop()
  if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') return name
  return undefined
}

export function installCommandFor(pm: PackageManager): string {
  return `${pm} install`
}

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
