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
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string }
  if (pkg.name !== 'create-orbit-app' || !pkg.version) {
    throw new Error(`create-orbit-app: unexpected package.json at ${pkgPath}`)
  }
  return pkg.version
}
