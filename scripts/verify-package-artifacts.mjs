import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const packagesDir = join(process.cwd(), 'packages')
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name))
  .sort()

const failures = []

for (const dir of packageDirs) {
  const manifestPath = join(dir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (manifest.private || !manifest.name?.startsWith('@orbit-ai/')) {
    continue
  }

  const requiredFiles = new Set()

  if (manifest.main) {
    requiredFiles.add(manifest.main)
  }

  if (manifest.types) {
    requiredFiles.add(manifest.types)
  }

  for (const binPath of Object.values(manifest.bin ?? {})) {
    requiredFiles.add(binPath)
  }

  collectExportFiles(manifest.exports, requiredFiles)

  for (const file of requiredFiles) {
    const normalized = file.replace(/^\.\//, '')
    if (!existsSync(join(dir, normalized))) {
      failures.push(`${manifest.name}: missing ${normalized}`)
    }
  }
}

if (failures.length > 0) {
  console.error('Package artifact verification failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Package artifact verification passed.')

function collectExportFiles(value, requiredFiles) {
  if (!value) {
    return
  }

  if (typeof value === 'string') {
    requiredFiles.add(value)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectExportFiles(item, requiredFiles)
    }
    return
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectExportFiles(item, requiredFiles)
    }
  }
}
