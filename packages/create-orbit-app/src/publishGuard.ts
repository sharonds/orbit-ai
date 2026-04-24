import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = '@orbit-ai/create-orbit-app'

interface ChangesetConfig {
  readonly fixed?: readonly (readonly string[])[]
}

export interface PublishGuardInput {
  readonly repoRoot?: string
}

export function assertFixedVersionGroup(input: PublishGuardInput = {}): void {
  const repoRoot = input.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const configPath = path.join(repoRoot, '.changeset', 'config.json')
  let config: ChangesetConfig
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as ChangesetConfig
  } catch (err) {
    throw new Error(
      `Plan B publish blocker: ${PACKAGE_NAME} must not be published until ${configPath} exists and includes it in a Changesets fixed-version group. Cause: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }

  const fixedGroups: readonly (readonly string[])[] = Array.isArray(config.fixed) ? config.fixed : []
  const covered = fixedGroups.some((group) => group.some((entry) => packagePatternCovers(entry, PACKAGE_NAME)))
  if (!covered) {
    throw new Error(
      `Plan B publish blocker: ${PACKAGE_NAME} is not covered by a Changesets fixed-version group in ${configPath}. Add ${PACKAGE_NAME} or @orbit-ai/* before publishing.`,
    )
  }
}

function packagePatternCovers(pattern: string, packageName: string): boolean {
  if (pattern === packageName) return true
  if (!pattern.endsWith('*')) return false
  return packageName.startsWith(pattern.slice(0, -1))
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    assertFixedVersionGroup()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
