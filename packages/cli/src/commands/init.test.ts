import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { runInit } from './init.js'
import { CliValidationError } from '../errors.js'

describe('runInit --org-id', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-init-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes orgId into .orbit/config.json when --org-id is a valid ULID', async () => {
    await runInit({
      db: 'sqlite',
      orgId: 'org_01HZ000000000000000000ABCD',
      yes: true,
      cwd: tmpDir,
    })

    const configPath = path.join(tmpDir, '.orbit', 'config.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as { orgId?: string }
    expect(parsed.orgId).toBe('org_01HZ000000000000000000ABCD')
  })

  it('throws CliValidationError with INVALID_ORG_ID for malformed --org-id', async () => {
    await expect(
      runInit({
        db: 'sqlite',
        orgId: 'BADVALUE',
        yes: true,
        cwd: tmpDir,
      }),
    ).rejects.toMatchObject({
      name: 'CliValidationError',
      details: { code: 'INVALID_ORG_ID' },
    })

    try {
      await runInit({
        db: 'sqlite',
        orgId: 'BADVALUE',
        yes: true,
        cwd: tmpDir,
      })
    } catch (err) {
      expect(err).toBeInstanceOf(CliValidationError)
    }
  })

  it('omits orgId from config when flag is not provided', async () => {
    await runInit({
      db: 'sqlite',
      yes: true,
      cwd: tmpDir,
    })

    const configPath = path.join(tmpDir, '.orbit', 'config.json')
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { orgId?: string }
    expect(parsed.orgId).toBeUndefined()
  })
})
