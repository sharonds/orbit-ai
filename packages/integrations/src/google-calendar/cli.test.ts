import { describe, it, expect, beforeEach } from 'vitest'
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
})
