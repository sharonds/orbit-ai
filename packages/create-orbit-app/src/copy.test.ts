import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { copyTemplate } from './copy.js'

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
})
