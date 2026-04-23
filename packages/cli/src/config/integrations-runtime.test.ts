import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { resolveIntegrationsRuntime } from './integrations-runtime.js'
import type { GlobalFlags } from '../types.js'

const TEST_KEY = 'a'.repeat(64)

describe('resolveIntegrationsRuntime', () => {
  let tmpRoot: string
  let originalKey: string | undefined
  let originalOrgId: string | undefined
  let originalUserId: string | undefined

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-int-runtime-'))
    originalKey = process.env['ORBIT_CREDENTIAL_KEY']
    originalOrgId = process.env['ORBIT_ORG_ID']
    originalUserId = process.env['ORBIT_USER_ID']
    delete process.env['ORBIT_ORG_ID']
    delete process.env['ORBIT_USER_ID']
  })

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    if (originalKey === undefined) delete process.env['ORBIT_CREDENTIAL_KEY']
    else process.env['ORBIT_CREDENTIAL_KEY'] = originalKey
    if (originalOrgId === undefined) delete process.env['ORBIT_ORG_ID']
    else process.env['ORBIT_ORG_ID'] = originalOrgId
    if (originalUserId === undefined) delete process.env['ORBIT_USER_ID']
    else process.env['ORBIT_USER_ID'] = originalUserId
  })

  it('throws CliValidationError when no .orbit/config.json exists', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-int-noconfig-'))
    try {
      await expect(
        resolveIntegrationsRuntime({ flags: {} as GlobalFlags, cwd }),
      ).rejects.toThrow(/orbit init/i)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('round-trips credentials via SQLite adapter and AES-GCM encryption', async () => {
    process.env['ORBIT_CREDENTIAL_KEY'] = TEST_KEY
    const orbitDir = path.join(tmpRoot, '.orbit')
    fs.mkdirSync(orbitDir, { recursive: true })
    fs.writeFileSync(
      path.join(orbitDir, 'config.json'),
      JSON.stringify({ orgId: 'org-test' }),
      { mode: 0o600 },
    )

    const flags: GlobalFlags = {
      orgId: 'org-test',
      adapter: 'sqlite',
      databaseUrl: ':memory:',
    }
    const ctx = await resolveIntegrationsRuntime({ flags, cwd: tmpRoot })

    expect(ctx.organizationId).toBe('org-test')
    expect(ctx.userId).toBe('cli-user')

    const creds = {
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      expiresAt: Date.now() + 3600_000,
      scopes: ['scope1', 'scope2'],
      providerAccountId: 'acct@example.com',
    }
    await ctx.credentialStore.saveCredentials('org-test', 'gmail', 'cli-user', creds)
    const loaded = await ctx.credentialStore.getCredentials('org-test', 'gmail', 'cli-user')
    expect(loaded).not.toBeNull()
    expect(loaded?.accessToken).toBe(creds.accessToken)
    expect(loaded?.refreshToken).toBe(creds.refreshToken)
    expect(loaded?.providerAccountId).toBe(creds.providerAccountId)
    expect(loaded?.scopes).toEqual(creds.scopes)
  })
})
