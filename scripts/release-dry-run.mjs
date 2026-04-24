import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const packagesDir = join(process.cwd(), 'packages')
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name))
  .sort()

const publishablePackages = packageDirs
  .map((dir) => {
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    return { dir, manifest }
  })
  .filter(({ manifest }) => !manifest.private && manifest.name?.startsWith('@orbit-ai/'))

if (publishablePackages.length === 0) {
  throw new Error('No publishable @orbit-ai packages found under packages/.')
}

for (const { dir, manifest } of publishablePackages) {
  console.log(`\n=== ${manifest.name}@${manifest.version} ===`)
  const result = spawnSync(
    'pnpm',
    [
      'publish',
      '--dry-run',
      '--access',
      'public',
      '--tag',
      'alpha',
      '--no-git-checks',
      '--ignore-scripts',
    ],
    { cwd: dir, encoding: 'utf8', stdio: 'inherit' },
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
