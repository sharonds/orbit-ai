import * as fs from 'node:fs/promises'
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
  const target = input.targetDir
  try {
    const entries = await fs.readdir(target)
    if (entries.length > 0) {
      throw new Error(`Target directory ${target} is not empty — refusing to overwrite.`)
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') throw err
    await fs.mkdir(target, { recursive: true })
  }

  await walkAndCopy(input.sourceDir, target, input.replacements)
}

async function walkAndCopy(
  from: string,
  to: string,
  replacements: Record<string, string>,
): Promise<void> {
  const entries = await fs.readdir(from, { withFileTypes: true })
  for (const entry of entries) {
    const fromPath = path.join(from, entry.name)
    const targetName = RENAME_MAP[entry.name] ?? entry.name
    const toPath = path.join(to, targetName)
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
  }
}

function applyReplacements(content: string, replacements: Record<string, string>): string {
  let out = content
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(key).join(value)  // literal, no regex — avoids special-char escapes
  }
  return out
}
