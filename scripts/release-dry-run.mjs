import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const packagesDir = join(process.cwd(), 'packages')
const pnpmBin = process.env.ORBIT_RELEASE_DRY_RUN_PNPM_BIN ?? 'pnpm'
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name))
  .sort()

const publishablePackages = packageDirs
  .map((dir) => {
    const manifestPath = join(dir, 'package.json')
    const manifest = readManifest(manifestPath)
    return { dir, manifest }
  })
  .filter(({ manifest }) => !manifest.private && manifest.name?.startsWith('@orbit-ai/'))

if (publishablePackages.length === 0) {
  throw new Error('No publishable @orbit-ai packages found under packages/.')
}

for (const { dir, manifest } of publishablePackages) {
  console.log(`\n=== ${manifest.name}@${manifest.version} ===`)
  const result = spawnSync(
    pnpmBin,
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

  if (result.error) {
    console.error(`pnpm publish --dry-run failed to spawn for ${manifest.name}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.signal) {
    console.error(`pnpm publish --dry-run for ${manifest.name} was killed by signal ${result.signal}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`pnpm publish --dry-run for ${manifest.name} exited with status ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

function readManifest(manifestPath) {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse ${manifestPath}: ${message}`)
  }
}
