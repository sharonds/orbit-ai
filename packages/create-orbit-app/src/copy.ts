import * as fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import * as path from 'node:path'

export interface CopyTemplateInput {
  readonly sourceDir: string
  readonly targetDir: string
  readonly replacements: Record<string, string>
}

const RENAME_MAP: Record<string, string> = {
  _gitignore: '.gitignore',
  _env: '.env',
  _envexample: '.env.example',
}

/**
 * Binary file extensions that must be copied byte-for-byte without placeholder substitution.
 * Keep this list tight; adding text-looking extensions here causes silent placeholder misses.
 */
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf'])

export async function copyTemplate(input: CopyTemplateInput): Promise<void> {
  const tempTarget = await prepareTargetDirectory(input.targetDir)
  try {
    await walkAndCopy(input.sourceDir, tempTarget, input.replacements)
    await commitTargetDirectory(tempTarget, input.targetDir)
  } catch (err) {
    await fs.rm(tempTarget, { recursive: true, force: true }).catch(() => {})
    throw err
  }
}

export async function prepareTargetDirectory(target: string): Promise<string> {
  const parent = path.dirname(target)
  const base = path.basename(target)
  await fs.mkdir(parent, { recursive: true })
  await assertTargetDoesNotExist(target)

  const tempTarget = await fs.mkdtemp(path.join(parent, `.${base}-`))
  await assertSafeDirectory(tempTarget)
  return tempTarget
}

async function assertTargetDoesNotExist(target: string): Promise<void> {
  try {
    const stats = await fs.lstat(target)
    if (stats.isSymbolicLink()) {
      throw new Error(`Target path ${target} is a symbolic link — refusing to scaffold outside the requested directory.`)
    }
    if (!stats.isDirectory()) {
      throw new Error(`Target path ${target} exists and is not a directory.`)
    }
    const entries = await fs.readdir(target)
    if (entries.length > 0) {
      throw new Error(`Target directory ${target} is not empty — refusing to overwrite.`)
    }
    throw new Error(`Target path ${target} already exists — refusing to overwrite.`)
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') return
    if (
      err instanceof Error &&
      (err.message.includes('already exists') ||
        err.message.includes('symbolic link') ||
        err.message.includes('not a directory') ||
        err.message.includes('is not empty'))
    ) {
      throw err
    }
    throw new Error(
      `Failed to inspect target ${target}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

async function commitTargetDirectory(tempTarget: string, target: string): Promise<void> {
  try {
    await fs.rename(tempTarget, target)
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EEXIST' || e.code === 'ENOTEMPTY') {
      throw new Error(`Target path ${target} already exists — refusing to overwrite.`, { cause: err })
    }
    throw err
  }
  await assertSafeDirectory(target)
}

async function assertSafeDirectory(target: string): Promise<void> {
  const stats = await fs.lstat(target)
  if (stats.isSymbolicLink()) {
    throw new Error(`Target path ${target} is a symbolic link — refusing to scaffold outside the requested directory.`)
  }
  if (!stats.isDirectory()) {
    throw new Error(`Target path ${target} exists and is not a directory.`)
  }
}

async function walkAndCopy(
  from: string,
  to: string,
  replacements: Record<string, string>,
): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(from, { withFileTypes: true })
  } catch (err) {
    throw new Error(
      `Failed to read template directory ${from}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
  for (const entry of entries) {
    const fromPath = path.join(from, entry.name)
    const targetName = RENAME_MAP[entry.name] ?? entry.name
    const toPath = path.join(to, targetName)
    try {
      if (entry.isDirectory()) {
        await fs.mkdir(toPath, { recursive: true })
        await walkAndCopy(fromPath, toPath, replacements)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (BINARY_EXTS.has(ext)) {
          await fs.copyFile(fromPath, toPath)
        } else {
          const content = await fs.readFile(fromPath, 'utf8')
          await fs.writeFile(toPath, applyReplacements(content, replacements))
        }
      }
      // Symlinks and special files: ignore in templates.
    } catch (err) {
      throw new Error(
        `Failed to copy template file ${fromPath} -> ${toPath}: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      )
    }
  }
}

function applyReplacements(content: string, replacements: Record<string, string>): string {
  let out = content
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(key).join(value)  // literal, no regex — avoids special-char escapes
  }
  return out
}
