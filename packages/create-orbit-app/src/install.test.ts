import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { detectPackageManager, inferPackageManagerFromCommand, installCommandFor, parseInstallCmd, runInstall } from './install.js'

describe('detectPackageManager', () => {
  it('uses npm_config_user_agent when present', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'pnpm/9.12.3 npm/? node/v22.0.0 linux x64' })).toBe('pnpm')
    expect(detectPackageManager({ npm_config_user_agent: 'yarn/4.0.0 npm/? node/v22.0.0' })).toBe('yarn')
    expect(detectPackageManager({ npm_config_user_agent: 'bun/1.0.0' })).toBe('bun')
    expect(detectPackageManager({ npm_config_user_agent: 'npm/10.0.0 node/v22.0.0' })).toBe('npm')
  })
  it('falls back to npm when no user-agent is set', () => {
    expect(detectPackageManager({})).toBe('npm')
  })

  it('falls back to npm for malformed or unknown user-agents', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'not-a-package-manager' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: 'unknown/1.0.0' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: 'bun-wasm/0.5.0' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: 'foo pnpm/9.12.3' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: '' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: 'pnpm/' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: 'yarn/' })).toBe('npm')
    expect(detectPackageManager({ npm_config_user_agent: 'bun/' })).toBe('npm')
  })
})

describe('parseInstallCmd', () => {
  it('splits a string command into argv tokens', () => {
    expect(parseInstallCmd('pnpm install')).toEqual(['pnpm', ['install']])
    expect(parseInstallCmd('npm install --no-fund')).toEqual(['npm', ['install', '--no-fund']])
  })

  it('preserves quoted arguments', () => {
    expect(parseInstallCmd('pnpm install --registry "https://registry.npmjs.org"')).toEqual([
      'pnpm',
      ['install', '--registry', 'https://registry.npmjs.org'],
    ])
  })

  it('rejects unterminated quotes', () => {
    expect(() => parseInstallCmd('pnpm install "unterminated')).toThrow(/unterminated/i)
  })
})

describe('inferPackageManagerFromCommand', () => {
  it('recognizes known package manager binaries in custom install commands', () => {
    expect(inferPackageManagerFromCommand('pnpm install')).toBe('pnpm')
    expect(inferPackageManagerFromCommand('npm ci')).toBe('npm')
    expect(inferPackageManagerFromCommand('yarn install --immutable')).toBe('yarn')
    expect(inferPackageManagerFromCommand('bun install')).toBe('bun')
  })

  it('returns undefined for non-package-manager commands', () => {
    expect(inferPackageManagerFromCommand('node ./scripts/install.js')).toBeUndefined()
  })
})

describe('installCommandFor', () => {
  it('prints the right install command for each package manager', () => {
    expect(installCommandFor('npm')).toBe('npm install')
    expect(installCommandFor('pnpm')).toBe('pnpm install')
    expect(installCommandFor('yarn')).toBe('yarn install')
    expect(installCommandFor('bun')).toBe('bun install')
  })
})

describe('runInstall (execa smoke)', () => {
  // Write a tiny JS file and run it via `node <path>`. Avoids `-e "..."`
  // quoting issues after parseInstallCmd whitespace-splits the command.
  function writeExitScript(dir: string, code: number): string {
    const file = path.join(dir, `exit-${code}.js`)
    fs.writeFileSync(file, `process.exit(${code})\n`)
    return file
  }

  it('resolves when the custom command exits zero', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-install-ok-'))
    try {
      const script = writeExitScript(cwd, 0)
      await expect(runInstall({ cwd, packageManager: 'npm', customCmd: `node ${script}` })).resolves.toBe('npm')
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('returns the custom command package manager when recognized', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-install-pm-'))
    try {
      await expect(runInstall({ cwd, packageManager: 'pnpm', customCmd: 'npm --version' })).resolves.toBe('npm')
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('treats shell metacharacters as literal argv', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-install-shell-'))
    try {
      const script = writeExitScript(cwd, 0)
      const pwned = path.join(cwd, 'pwned')
      await runInstall({ cwd, customCmd: `node ${script} && touch pwned` })
      expect(fs.existsSync(pwned)).toBe(false)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('rejects when the custom command exits nonzero', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-install-fail-'))
    try {
      const script = writeExitScript(cwd, 1)
      await expect(runInstall({ cwd, customCmd: `node ${script}` })).rejects.toThrow()
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
})
