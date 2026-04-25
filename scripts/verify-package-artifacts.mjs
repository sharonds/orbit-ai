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
  let manifest
  try {
    manifest = readManifest(manifestPath)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    failures.push(message)
    continue
  }

  if (manifest.private || !manifest.name?.startsWith('@orbit-ai/')) {
    continue
  }

  validatePackageReadiness(dir, manifest, failures)

  const requiredFiles = new Set()

  if (manifest.main) {
    requiredFiles.add(manifest.main)
  }

  if (manifest.types) {
    requiredFiles.add(manifest.types)
  }

  collectBinFiles(manifest, requiredFiles, failures)
  collectExportFiles(manifest.exports, requiredFiles)

  for (const file of requiredFiles) {
    const normalized = normalizePackagePath(file)
    if (!existsSync(join(dir, normalized))) {
      failures.push(`${manifest.name}: missing ${normalized}`)
      continue
    }

    if (!isIncludedByFilesAllowlist(normalized, manifest.files)) {
      failures.push(`${manifest.name}: ${normalized} is not covered by package.json "files"`)
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

function readManifest(manifestPath) {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse ${manifestPath}: ${message}`)
  }
}

function validatePackageReadiness(dir, manifest, failures) {
  for (const field of ['name', 'version', 'description', 'license']) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      failures.push(`${manifest.name ?? dir}: missing "${field}" field in package.json`)
    }
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    failures.push(`${manifest.name ?? dir}: missing non-empty "files" array in package.json`)
  }

  for (const file of ['README.md', 'LICENSE']) {
    if (!existsSync(join(dir, file))) {
      failures.push(`${manifest.name ?? dir}: missing ${file}`)
    } else if (!isIncludedByFilesAllowlist(file, manifest.files)) {
      failures.push(`${manifest.name ?? dir}: ${file} is not covered by package.json "files"`)
    }
  }
}

function collectBinFiles(manifest, requiredFiles, failures) {
  if (!Object.hasOwn(manifest, 'bin')) {
    return
  }

  if (typeof manifest.bin === 'string') {
    if (manifest.bin.trim() === '') {
      failures.push(`${manifest.name}: "bin" must be a non-empty string`)
      return
    }
    requiredFiles.add(manifest.bin)
    return
  }

  if (typeof manifest.bin === 'object' && manifest.bin !== null && !Array.isArray(manifest.bin)) {
    const entries = Object.entries(manifest.bin)
    if (entries.length === 0) {
      failures.push(`${manifest.name}: "bin" object must not be empty`)
      return
    }

    for (const [binName, binPath] of entries) {
      if (typeof binPath === 'string' && binPath.trim() !== '') {
        requiredFiles.add(binPath)
      } else {
        failures.push(`${manifest.name}: "bin.${binName}" must be a non-empty string`)
      }
    }
    return
  }

  failures.push(`${manifest.name}: "bin" must be a string or object`)
}

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

function normalizePackagePath(file) {
  return file.replace(/^\.\//, '').replace(/\/+$/, '')
}

function isIncludedByFilesAllowlist(file, files) {
  if (!Array.isArray(files)) {
    return false
  }

  const normalizedFile = normalizePackagePath(file)
  let included = false

  for (const entry of files) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      continue
    }

    const trimmedEntry = entry.trim()
    const negated = trimmedEntry.startsWith('!')
    const normalizedEntry = normalizePackagePath(negated ? trimmedEntry.slice(1) : trimmedEntry)
    if (normalizedEntry === '') {
      continue
    }

    if (allowlistEntryMatches(normalizedEntry, normalizedFile)) {
      included = !negated
    }
  }

  return included
}

function allowlistEntryMatches(entry, file) {
  if (isGlobPattern(entry)) {
    return globToRegExp(entry).test(file)
  }

  return entry === file || file.startsWith(`${entry}/`)
}

function isGlobPattern(value) {
  return /[*?[{]/.test(value)
}

function globToRegExp(glob) {
  let source = '^'
  for (let index = 0; index < glob.length; ) {
    const char = glob[index]

    if (char === '*') {
      if (glob[index + 1] === '*') {
        if (glob[index + 2] === '/') {
          source += '(?:.*/)?'
          index += 3
        } else {
          source += '.*'
          index += 2
        }
      } else {
        source += '[^/]*'
        index += 1
      }
      continue
    }

    if (char === '?') {
      source += '[^/]'
      index += 1
      continue
    }

    if (char === '[') {
      const end = glob.indexOf(']', index + 1)
      if (end > index + 1) {
        source += glob.slice(index, end + 1)
        index = end + 1
        continue
      }
    }

    if (char === '{') {
      const end = glob.indexOf('}', index + 1)
      if (end > index + 1) {
        const alternatives = glob
          .slice(index + 1, end)
          .split(',')
          .map((part) => escapeRegExp(part))
          .join('|')
        source += `(?:${alternatives})`
        index = end + 1
        continue
      }
    }

    source += escapeRegExp(char)
    index += 1
  }

  return new RegExp(`${source}$`)
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}
