import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { run } from '../index.js'

describe('create-orbit-app smoke', () => {
  it('scaffolds a default project from argv without prompting', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-smoke-'))
    const cwd = process.cwd()
    try {
      process.chdir(workDir)
      await run(['my-app', '--yes', '--no-install'])
      const projectDir = path.join(workDir, 'my-app')
      expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(projectDir, 'src', 'index.ts'))).toBe(true)
      expect(fs.existsSync(path.join(projectDir, '.gitignore'))).toBe(true)

      const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
      expect(pkg.name).toBe('my-app')
      // `--yes` defaults the template to `default`, and the version placeholder was replaced with a real semver.
      expect(pkg.dependencies['@orbit-ai/core']).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)
      // No placeholders remain anywhere.
      const content = fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')
      expect(content).not.toContain('__APP_NAME__')
      expect(content).not.toContain('__ORBIT_VERSION__')
    } finally {
      process.chdir(cwd)
      fs.rmSync(workDir, { recursive: true, force: true })
    }
  }, 60_000)
})
