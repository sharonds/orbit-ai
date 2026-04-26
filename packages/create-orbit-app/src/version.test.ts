import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOrbitVersion, getOrbitVersionFrom } from './version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.resolve(__dirname, '..', 'package.json')

function writePackageJson(pkg: { name?: string; version?: string }): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-version-'))
  const pkgPath = path.join(tmpDir, 'package.json')
  fs.writeFileSync(pkgPath, JSON.stringify(pkg), 'utf8')
  return pkgPath
}

describe('getOrbitVersion', () => {
  it('returns a valid semver or semver-pre string', () => {
    const v = getOrbitVersion()
    expect(v).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)
  })

  it('returns the package.json version verbatim', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version: string }
    expect(getOrbitVersion()).toBe(pkg.version)
  })

  it('returns an exact alpha prerelease version, not a range', () => {
    const v = getOrbitVersion()
    expect(v).toMatch(/^\d+\.\d+\.\d+-alpha\.\d+$/)
    expect(v).not.toMatch(/^[~^]/)
  })
})

describe('getOrbitVersionFrom', () => {
  it('throws a reinstall-hint error when the package.json path does not exist', () => {
    expect(() => getOrbitVersionFrom('/nonexistent/package.json')).toThrow(
      /installation may be corrupt/,
    )
    expect(() => getOrbitVersionFrom('/nonexistent/package.json')).toThrow(
      /npx @orbit-ai\/create-orbit-app@alpha/,
    )
  })

  it('throws when the package.json name is not create-orbit-app', () => {
    const pkgPath = writePackageJson({
      name: '@orbit-ai/not-create-orbit-app',
      version: '0.1.0-alpha.0',
    })
    try {
      expect(() => getOrbitVersionFrom(pkgPath)).toThrow(/unexpected package\.json/)
    } finally {
      fs.rmSync(path.dirname(pkgPath), { recursive: true, force: true })
    }
  })

  it('throws when package.json is missing a version', () => {
    const pkgPath = writePackageJson({ name: '@orbit-ai/create-orbit-app' })
    try {
      expect(() => getOrbitVersionFrom(pkgPath)).toThrow(/unexpected package\.json/)
    } finally {
      fs.rmSync(path.dirname(pkgPath), { recursive: true, force: true })
    }
  })
})
