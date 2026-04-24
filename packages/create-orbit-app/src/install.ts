import { execa } from 'execa'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export function detectPackageManager(env: NodeJS.ProcessEnv): PackageManager {
  const ua = env.npm_config_user_agent ?? ''
  if (ua.startsWith('pnpm/')) return 'pnpm'
  if (ua.startsWith('yarn/')) return 'yarn'
  if (ua.startsWith('bun/')) return 'bun'
  return 'npm'
}

export function parseInstallCmd(cmd: string): [string, string[]] {
  const parts = cmd.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) throw new Error('Empty install command')
  return [parts[0], parts.slice(1)]
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
  const [cmd, args] = input.customCmd
    ? parseInstallCmd(input.customCmd)
    : parseInstallCmd(installCommandFor(pm))
  await execa(cmd, args, { cwd: input.cwd, stdio: 'inherit' })
  return pm
}
