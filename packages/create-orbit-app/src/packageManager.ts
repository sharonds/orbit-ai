export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export function detectPackageManager(env: NodeJS.ProcessEnv): PackageManager {
  const ua = env.npm_config_user_agent ?? ''
  if (/^pnpm\/\d/.test(ua)) return 'pnpm'
  if (/^yarn\/\d/.test(ua)) return 'yarn'
  if (/^bun\/\d/.test(ua)) return 'bun'
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
