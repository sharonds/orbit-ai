import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { resolveIntegrationsRuntime } from './integrations-runtime.js'
import type { GlobalFlags } from '../types.js'
import { _resetJsonMode, _setJsonMode } from '../program.js'

const TEST_KEY = 'a'.repeat(64)
const ORG_TEST = 'org_01ABCDEF0123456789ABCDEF01'

describe('resolveIntegrationsRuntime', () => {
  let tmpRoot: string
  let originalKey: string | undefined
  let originalOrgId: string | undefined
  let originalUserId: string | undefined
  let originalProfile: string | undefined
  let originalHome: string | undefined

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-int-runtime-'))
    originalKey = process.env['ORBIT_CREDENTIAL_KEY']
    originalOrgId = process.env['ORBIT_ORG_ID']
    originalUserId = process.env['ORBIT_USER_ID']
    originalProfile = process.env['ORBIT_PROFILE']
    originalHome = process.env['HOME']
    delete process.env['ORBIT_ORG_ID']
    delete process.env['ORBIT_USER_ID']
    delete process.env['ORBIT_PROFILE']
  })

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    if (originalKey === undefined) delete process.env['ORBIT_CREDENTIAL_KEY']
    else process.env['ORBIT_CREDENTIAL_KEY'] = originalKey
    if (originalOrgId === undefined) delete process.env['ORBIT_ORG_ID']
    else process.env['ORBIT_ORG_ID'] = originalOrgId
    if (originalUserId === undefined) delete process.env['ORBIT_USER_ID']
    else process.env['ORBIT_USER_ID'] = originalUserId
    if (originalProfile === undefined) delete process.env['ORBIT_PROFILE']
    else process.env['ORBIT_PROFILE'] = originalProfile
    if (originalHome === undefined) delete process.env['HOME']
    else process.env['HOME'] = originalHome
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
      JSON.stringify({ orgId: ORG_TEST }),
      { mode: 0o600 },
    )

    const flags: GlobalFlags = {
      orgId: ORG_TEST,
      adapter: 'sqlite',
      databaseUrl: ':memory:',
    }
    const ctx = await resolveIntegrationsRuntime({ flags, cwd: tmpRoot, applySchema: true })

    expect(ctx.organizationId).toBe(ORG_TEST)
    expect(ctx.userId).toBe('cli-user')

    const creds = {
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      expiresAt: Date.now() + 3600_000,
      scopes: ['scope1', 'scope2'],
      providerAccountId: 'acct@example.com',
    }
    await ctx.credentialStore.saveCredentials(ORG_TEST, 'gmail', 'cli-user', creds)
    const loaded = await ctx.credentialStore.getCredentials(ORG_TEST, 'gmail', 'cli-user')
    expect(loaded).not.toBeNull()
    expect(loaded?.accessToken).toBe(creds.accessToken)
    expect(loaded?.refreshToken).toBe(creds.refreshToken)
    expect(loaded?.providerAccountId).toBe(creds.providerAccountId)
    expect(loaded?.scopes).toEqual(creds.scopes)
  })

  it('rejects non-Crockford org_id format with INVALID_ORG_ID (runtime strict check)', async () => {
    process.env['ORBIT_CREDENTIAL_KEY'] = TEST_KEY
    const orbitDir = path.join(tmpRoot, '.orbit')
    fs.mkdirSync(orbitDir, { recursive: true })
    fs.writeFileSync(path.join(orbitDir, 'config.json'), JSON.stringify({ userId: 'someone' }), {
      mode: 0o600,
    })
    // 'I' is not a valid Crockford Base32 character
    const flags: GlobalFlags = { orgId: 'org_01HZIIIIIIIIIIIIIIIIIIIIII', adapter: 'sqlite', databaseUrl: ':memory:' }
    await expect(
      resolveIntegrationsRuntime({ flags, cwd: tmpRoot }),
    ).rejects.toMatchObject({ details: { code: 'INVALID_ORG_ID', path: 'context.orgId' } })
  })

  it('rejects whitespace-only --org-id with MISSING_REQUIRED_CONFIG', async () => {
    const orbitDir = path.join(tmpRoot, '.orbit')
    fs.mkdirSync(orbitDir, { recursive: true })
    fs.writeFileSync(path.join(orbitDir, 'config.json'), JSON.stringify({ userId: 'someone' }), {
      mode: 0o600,
    })
    const flags: GlobalFlags = { orgId: '   ', adapter: 'sqlite', databaseUrl: ':memory:' }
    await expect(
      resolveIntegrationsRuntime({ flags, cwd: tmpRoot }),
    ).rejects.toMatchObject({ details: { code: 'MISSING_REQUIRED_CONFIG', path: 'context.orgId' } })
  })

  it('rejects empty --org-id with MISSING_REQUIRED_CONFIG', async () => {
    const orbitDir = path.join(tmpRoot, '.orbit')
    fs.mkdirSync(orbitDir, { recursive: true })
    fs.writeFileSync(path.join(orbitDir, 'config.json'), JSON.stringify({ userId: 'someone' }), {
      mode: 0o600,
    })
    const flags: GlobalFlags = { orgId: '', adapter: 'sqlite', databaseUrl: ':memory:' }
    await expect(
      resolveIntegrationsRuntime({ flags, cwd: tmpRoot }),
    ).rejects.toMatchObject({ details: { code: 'MISSING_REQUIRED_CONFIG', path: 'context.orgId' } })
  })

  it('recursively masks secrets in JSON-mode print output', async () => {
    process.env['ORBIT_CREDENTIAL_KEY'] = TEST_KEY
    const orbitDir = path.join(tmpRoot, '.orbit')
    fs.mkdirSync(orbitDir, { recursive: true })
    fs.writeFileSync(
      path.join(orbitDir, 'config.json'),
      JSON.stringify({ orgId: ORG_TEST }),
      { mode: 0o600 },
    )
    _setJsonMode(true)
    try {
      const flags: GlobalFlags = {
        orgId: ORG_TEST,
        adapter: 'sqlite',
        databaseUrl: ':memory:',
      }
      const ctx = await resolveIntegrationsRuntime({ flags, cwd: tmpRoot, applySchema: true })
      const logs: string[] = []
      const original = console.log
      console.log = (msg?: unknown) => {
        logs.push(String(msg))
      }
      try {
        ctx.print({
          accessToken: 'SECRET',
          nested: { refreshToken: 'NESTED_SECRET', visible: 'ok' },
        })
      } finally {
        console.log = original
      }
      expect(logs).toHaveLength(1)
      const out = logs[0]
      expect(out).not.toContain('SECRET')
      expect(out).not.toContain('NESTED_SECRET')
      expect(out).toContain('***')
      expect(out).toContain('ok')
      const parsed = JSON.parse(out!) as {
        accessToken: string
        nested: { refreshToken: string; visible: string }
      }
      expect(parsed.accessToken).toBe('***')
      expect(parsed.nested.refreshToken).toBe('***')
      expect(parsed.nested.visible).toBe('ok')
    } finally {
      _resetJsonMode()
    }
  })

  it('resolves profile precedence as --profile over ORBIT_PROFILE over config.profile', async () => {
    process.env['ORBIT_CREDENTIAL_KEY'] = TEST_KEY
    process.env['HOME'] = tmpRoot
    process.env['ORBIT_PROFILE'] = 'env-profile'
    const userConfigDir = path.join(tmpRoot, '.config', 'orbit')
    fs.mkdirSync(userConfigDir, { recursive: true })
    fs.writeFileSync(
      path.join(userConfigDir, 'config.json'),
      JSON.stringify({
        orgId: 'org_00BASE00000000000000000000',
        profile: 'config-profile',
        profiles: {
          'config-profile': { orgId: 'org_00C0NFG0000000000000000000', userId: 'user-config' },
          'env-profile': { orgId: 'org_00ENVR00000000000000000000', userId: 'user-env' },
          'flag-profile': { orgId: 'org_00FRAG00000000000000000000', userId: 'user-flag' },
        },
      }),
      { mode: 0o600 },
    )

    const envCtx = await resolveIntegrationsRuntime({
      flags: { adapter: 'sqlite', databaseUrl: ':memory:' },
      cwd: tmpRoot,
    })
    expect(envCtx.organizationId).toBe('org_00ENVR00000000000000000000')
    expect(envCtx.userId).toBe('user-env')

    const flagCtx = await resolveIntegrationsRuntime({
      flags: { adapter: 'sqlite', databaseUrl: ':memory:', profile: 'flag-profile' },
      cwd: tmpRoot,
    })
    expect(flagCtx.organizationId).toBe('org_00FRAG00000000000000000000')
    expect(flagCtx.userId).toBe('user-flag')

    delete process.env['ORBIT_PROFILE']
    const configCtx = await resolveIntegrationsRuntime({
      flags: { adapter: 'sqlite', databaseUrl: ':memory:' },
      cwd: tmpRoot,
    })
    expect(configCtx.organizationId).toBe('org_00C0NFG0000000000000000000')
    expect(configCtx.userId).toBe('user-config')
  })

  it('does not request migration authority unless schema application is explicitly enabled', async () => {
    process.env['ORBIT_CREDENTIAL_KEY'] = TEST_KEY
    const orbitDir = path.join(tmpRoot, '.orbit')
    fs.mkdirSync(orbitDir, { recursive: true })
    fs.writeFileSync(path.join(orbitDir, 'config.json'), JSON.stringify({ orgId: ORG_TEST }), {
      mode: 0o600,
    })

    const ctx = await resolveIntegrationsRuntime({
      flags: { orgId: ORG_TEST, adapter: 'sqlite', databaseUrl: ':memory:' },
      cwd: tmpRoot,
    })

    await expect(
      ctx.credentialStore.saveCredentials(ORG_TEST, 'gmail', 'cli-user', {
        accessToken: 'a',
        refreshToken: 'r',
      }),
    ).rejects.toThrow(/integration_connections|no such table/i)
  })
})
