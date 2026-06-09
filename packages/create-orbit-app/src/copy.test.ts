import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { copyTemplate, prepareTargetDirectory } from './copy.js'

describe('copyTemplate', () => {
  it('copies files recursively and replaces placeholders', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    fs.writeFileSync(path.join(src, 'package.json'), '{"name":"__APP_NAME__","dep":"__ORBIT_VERSION__"}')
    fs.mkdirSync(path.join(src, 'nested'))
    fs.writeFileSync(path.join(src, 'nested', 'file.ts'), 'export const v = "__APP_NAME__"')

    try {
      await copyTemplate({
        sourceDir: src,
        targetDir: path.join(dst, 'out'),
        replacements: { __APP_NAME__: 'my-app', __ORBIT_VERSION__: '0.1.0-alpha.1' },
      })
      const pkg = JSON.parse(fs.readFileSync(path.join(dst, 'out', 'package.json'), 'utf8'))
      expect(pkg.name).toBe('my-app')
      expect(pkg.dep).toBe('0.1.0-alpha.1')
      const nested = fs.readFileSync(path.join(dst, 'out', 'nested', 'file.ts'), 'utf8')
      expect(nested).toContain('"my-app"')
    } finally {
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite a non-empty target directory', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    fs.writeFileSync(path.join(dst, 'existing.txt'), 'hello')
    try {
      await expect(
        copyTemplate({ sourceDir: src, targetDir: dst, replacements: {} }),
      ).rejects.toThrow(/not empty/i)
    } finally {
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('refuses to use an existing empty target directory', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    try {
      await expect(
        copyTemplate({ sourceDir: src, targetDir: dst, replacements: {} }),
      ).rejects.toThrow(/already exists/i)
    } finally {
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('renames _gitignore to .gitignore (dotfile convention)', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    fs.writeFileSync(path.join(src, '_gitignore'), 'node_modules\n')
    try {
      await copyTemplate({ sourceDir: src, targetDir: path.join(dst, 'out'), replacements: {} })
      expect(fs.existsSync(path.join(dst, 'out', '.gitignore'))).toBe(true)
      expect(fs.existsSync(path.join(dst, 'out', '_gitignore'))).toBe(false)
    } finally {
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('wraps missing template source errors with source path context', async () => {
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    const missing = path.join(os.tmpdir(), 'missing-template-source')
    try {
      await expect(
        copyTemplate({ sourceDir: missing, targetDir: path.join(dst, 'out'), replacements: {} }),
      ).rejects.toThrow(new RegExp(`template directory ${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    } finally {
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('prints cleanup failures to stderr while preserving the original copy error', async () => {
    vi.resetModules()
    const rmMock = vi.fn().mockRejectedValueOnce(new Error('cleanup denied'))
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        rm: rmMock,
      }
    })
    const { copyTemplate: copyTemplateWithMockedRm } = await import('./copy.js')
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    const missing = path.join(os.tmpdir(), 'missing-template-source')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(
        copyTemplateWithMockedRm({ sourceDir: missing, targetDir: path.join(dst, 'out'), replacements: {} }),
      ).rejects.toThrow(new RegExp(`template directory ${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))

      expect(rmMock).toHaveBeenCalled()
      const messages = errSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
      expect(messages).toMatch(/cleanup/i)
      expect(messages).toMatch(/cleanup denied/)
    } finally {
      errSpy.mockRestore()
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('removes the final target and sibling temporary directories when the second template file write fails', async () => {
    vi.resetModules()
    let writeCount = 0
    const writeFileMock = vi.fn(
      async (...args: Parameters<typeof import('node:fs/promises')['writeFile']>) => {
        writeCount += 1
        if (writeCount === 2) {
          throw new Error('sabotaged second write')
        }
        const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
        return actual.writeFile(...args)
      },
    )
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        writeFile: writeFileMock,
      }
    })
    const { copyTemplate: copyTemplateWithMockedWrite } = await import('./copy.js')
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    const target = path.join(dst, 'out')
    fs.writeFileSync(path.join(src, '01-first.txt'), 'first')
    fs.writeFileSync(path.join(src, '02-second.txt'), 'second')
    try {
      await expect(
        copyTemplateWithMockedWrite({ sourceDir: src, targetDir: target, replacements: {} }),
      ).rejects.toThrow(/sabotaged second write/)

      expect(fs.existsSync(target)).toBe(false)
      const tempSiblingPrefix = `.${path.basename(target)}-`
      const remainingTempSiblings = fs
        .readdirSync(path.dirname(target))
        .filter((entry) => entry.startsWith(tempSiblingPrefix))
      expect(remainingTempSiblings).toEqual([])
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('does not copy or dereference source-template symlinks that point outside the template directory', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'external-'))
    const target = path.join(dst, 'out')
    const secret = 'external-secret-content'
    fs.writeFileSync(path.join(src, 'safe.txt'), 'safe content')
    fs.writeFileSync(path.join(external, 'secret.txt'), secret)
    fs.symlinkSync(path.join(external, 'secret.txt'), path.join(src, 'leak.txt'), 'file')
    try {
      await copyTemplate({ sourceDir: src, targetDir: target, replacements: {} })

      expect(fs.existsSync(path.join(target, 'leak.txt'))).toBe(false)
      const generatedFiles = fs.readdirSync(target, { recursive: true, withFileTypes: true })
      const generatedContent = generatedFiles
        .filter((entry) => entry.isFile())
        .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
        .join('\n')
      expect(generatedContent).not.toContain(secret)
    } finally {
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
      fs.rmSync(external, { recursive: true, force: true })
    }
  })

  it('does not copy, dereference, or read source-template special files', async () => {
    vi.resetModules()
    const realSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    const target = path.join(dst, 'out')
    const specialFileName = 'socket-like-special'
    const specialFilePath = path.join(realSourceDir, specialFileName)
    let specialDirentReturned = false
    const specialDirent = {
      name: specialFileName,
      parentPath: realSourceDir,
      isDirectory: () => false,
      isFile: () => false,
      isSymbolicLink: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => true,
    }
    const readFileMock = vi.fn(
      async (...args: Parameters<typeof import('node:fs/promises')['readFile']>) => {
        const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
        return actual.readFile(...args)
      },
    )
    const copyFileMock = vi.fn(
      async (...args: Parameters<typeof import('node:fs/promises')['copyFile']>) => {
        const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
        return actual.copyFile(...args)
      },
    )
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        copyFile: copyFileMock,
        readFile: readFileMock,
        readdir: vi.fn(
          async (...args: Parameters<typeof import('node:fs/promises')['readdir']>) => {
            const [dir, options] = args
            if (dir === realSourceDir && options && typeof options === 'object' && 'withFileTypes' in options) {
              specialDirentReturned = true
              return [specialDirent]
            }
            return actual.readdir(...args)
          },
        ),
      }
    })
    const { copyTemplate: copyTemplateWithSpecialFile } = await import('./copy.js')
    try {
      await copyTemplateWithSpecialFile({ sourceDir: realSourceDir, targetDir: target, replacements: {} })

      expect(specialDirentReturned).toBe(true)
      expect(fs.existsSync(path.join(target, specialFileName))).toBe(false)
      expect(readFileMock.mock.calls.some(([file]) => file === specialFilePath)).toBe(false)
      expect(copyFileMock.mock.calls.some(([src]) => src === specialFilePath)).toBe(false)
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
      fs.rmSync(realSourceDir, { recursive: true, force: true })
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })

  it('refuses to scaffold into a symlink target', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'))
    const realTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'real-target-'))
    const linkTarget = path.join(os.tmpdir(), `target-link-${Date.now()}`)
    fs.writeFileSync(path.join(src, 'package.json'), '{"name":"__APP_NAME__"}')
    fs.symlinkSync(realTarget, linkTarget, 'dir')
    try {
      await expect(
        copyTemplate({ sourceDir: src, targetDir: linkTarget, replacements: { __APP_NAME__: 'my-app' } }),
      ).rejects.toThrow(/symbolic link/i)
    } finally {
      fs.rmSync(src, { recursive: true, force: true })
      fs.rmSync(realTarget, { recursive: true, force: true })
      fs.rmSync(linkTarget, { force: true })
    }
  })

  it('prepares a temporary target directory without creating the final target', async () => {
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'))
    const target = path.join(dst, 'out')
    try {
      const tempTarget = await prepareTargetDirectory(target)
      expect(tempTarget).not.toBe(target)
      expect(path.dirname(tempTarget)).toBe(dst)
      expect(fs.existsSync(target)).toBe(false)
      expect(fs.lstatSync(tempTarget).isDirectory()).toBe(true)
      expect(fs.lstatSync(tempTarget).isSymbolicLink()).toBe(false)
    } finally {
      fs.rmSync(dst, { recursive: true, force: true })
    }
  })
})
