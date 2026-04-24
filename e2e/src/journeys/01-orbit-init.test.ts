import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { runCli } from '../harness/run-cli.js'

describe('Journey 1 — orbit init', () => {
  it('scaffolds .orbit/config.json and .env.example in an empty dir', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-init-'))
    try {
      const res = await runCli({
        args: ['init', '--db', 'sqlite', '--org-name', 'Acme Events', '--yes'],
        cwd,
      })
      expect(res.exitCode).toBe(0)
      expect(fs.existsSync(path.join(cwd, '.orbit', 'config.json'))).toBe(true)
      expect(fs.existsSync(path.join(cwd, '.env.example'))).toBe(true)
      const config = JSON.parse(fs.readFileSync(path.join(cwd, '.orbit', 'config.json'), 'utf8'))
      expect(config.mode).toBe('direct')
      expect(config.adapter).toBe('sqlite')
      expect(config.orgName).toBe('Acme Events')
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('preserves existing files without --overwrite', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-init-'))
    try {
      await runCli({ args: ['init', '--db', 'sqlite', '--org-name', 'X', '--yes'], cwd })
      const before = fs.readFileSync(path.join(cwd, '.orbit', 'config.json'), 'utf8')
      const res = await runCli({ args: ['init', '--db', 'sqlite', '--org-name', 'Y', '--yes'], cwd })
      expect(res.exitCode).toBe(0)
      expect(fs.readFileSync(path.join(cwd, '.orbit', 'config.json'), 'utf8')).toBe(before)
      expect(res.stderr).toMatch(/Skipping existing|overwrite/i)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
})
