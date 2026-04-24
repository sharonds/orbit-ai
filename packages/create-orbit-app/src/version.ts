import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Read our own package.json to get the pinned orbit version.
 * Works from both src/version.ts (tests) and dist/version.js (runtime) —
 * both live exactly one level below the package root.
 */
export function getOrbitVersion(): string {
  const pkgPath = path.resolve(__dirname, '..', 'package.json')
  return getOrbitVersionFrom(pkgPath)
}

/**
 * Testable overload: read the pinned orbit version from an explicit package.json path.
 * Any I/O or parse failure is wrapped in a user-facing error that points at
 * re-installation as the fix (the most common cause is a corrupt global install).
 */
export function getOrbitVersionFrom(pkgPath: string): string {
  let pkg: { name?: string; version?: string }
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string }
  } catch (err) {
    throw new Error(
      `create-orbit-app: unable to read own package.json at ${pkgPath} — installation may be corrupt. Reinstall with 'npm i -g create-orbit-app'. Cause: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
  if (pkg.name !== 'create-orbit-app' || !pkg.version) {
    throw new Error(`create-orbit-app: unexpected package.json at ${pkgPath}`)
  }
  return pkg.version
}
