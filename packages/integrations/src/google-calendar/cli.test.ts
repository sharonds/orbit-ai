import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildCalendarCommands, type CalendarConfigureArgs } from './cli.js'
import { InMemoryCredentialStore } from '../credentials.js'
import type { CliRuntimeContext } from '../types.js'

describe('google-calendar CLI commands', () => {
  let store: InMemoryCredentialStore
  let runtime: CliRuntimeContext
  let printed: unknown[]

  beforeEach(() => {
    store = new InMemoryCredentialStore()
    printed = []
    runtime = {
      organizationId: 'org_01TEST',
      userId: 'user_01TEST',
      credentialStore: store,
      isJsonMode: true,
      print: (v) => { printed.push(v) },
    }
  })

  it('configure persists OAuth2 tokens and prints configured=true with --skip-validation', async () => {
    const cmds = buildCalendarCommands(runtime)
    const configure = cmds.find((c) => c.name === 'google-calendar/configure')!
    await configure.action({
      accessToken: 'a',
      refreshToken: 'r',
      skipValidation: true,
    } satisfies CalendarConfigureArgs)
    expect(printed[0]).toMatchObject({ configured: true, provider: 'google-calendar' })
    expect(await store.getCredentials('org_01TEST', 'google-calendar', 'user_01TEST')).toBeTruthy()
  })

  it('configure without --skip-validation refuses (alpha scope)', async () => {
    const cmds = buildCalendarCommands(runtime)
    const configure = cmds.find((c) => c.name === 'google-calendar/configure')!
    await configure.action({ accessToken: 'a', refreshToken: 'r' })
    expect(printed[0]).toMatchObject({ configured: false, provider: 'google-calendar' })
    expect(await store.getCredentials('org_01TEST', 'google-calendar', 'user_01TEST')).toBeNull()
  })

  it('status reports configured=false when no credentials saved', async () => {
    const cmds = buildCalendarCommands(runtime)
    const status = cmds.find((c) => c.name === 'google-calendar/status')!
    await status.action({})
    expect(printed[0]).toMatchObject({ configured: false, status: 'not_configured', provider: 'google-calendar' })
  })

  it('configure does not print raw secrets to stdout', async () => {
    const cmds = buildCalendarCommands(runtime)
    const configure = cmds.find((c) => c.name === 'google-calendar/configure')!
    await configure.action({
      accessToken: 'SECRET_ACCESS_VALUE',
      refreshToken: 'SECRET_REFRESH_VALUE',
      skipValidation: true,
    })
    const out = JSON.stringify(printed)
    expect(out).not.toContain('SECRET_ACCESS_VALUE')
    expect(out).not.toContain('SECRET_REFRESH_VALUE')
  })

  it('configure accepts OAuth2 tokens from files instead of argv token values', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-calendar-token-files-'))
    try {
      const accessTokenFile = path.join(tmpDir, 'access-token')
      const refreshTokenFile = path.join(tmpDir, 'refresh-token')
      fs.writeFileSync(accessTokenFile, 'file-access\n', { mode: 0o600 })
      fs.writeFileSync(refreshTokenFile, 'file-refresh\n', { mode: 0o600 })
      const cmds = buildCalendarCommands(runtime)
      const configure = cmds.find((c) => c.name === 'google-calendar/configure')!
      await configure.action({
        accessTokenFile,
        refreshTokenFile,
        skipValidation: true,
      } satisfies CalendarConfigureArgs)

      const saved = await store.getCredentials('org_01TEST', 'google-calendar', 'user_01TEST')
      expect(saved?.accessToken).toBe('file-access')
      expect(saved?.refreshToken).toBe('file-refresh')
      expect(JSON.stringify(printed)).not.toContain('file-access')
      expect(JSON.stringify(printed)).not.toContain('file-refresh')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
