import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildStripeCommands, type StripeConfigureArgs } from './cli.js'
import { InMemoryCredentialStore } from '../credentials.js'
import type { CliRuntimeContext } from '../types.js'

describe('stripe CLI commands', () => {
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

  it('configure with ORBIT_STRIPE_API_KEY env and --skip-validation saves credentials and prints configured=true', async () => {
    const prev = process.env.ORBIT_STRIPE_API_KEY
    process.env.ORBIT_STRIPE_API_KEY = 'sk_test_from_env'
    try {
      const cmds = buildStripeCommands(runtime)
      const configure = cmds.find((c) => c.name === 'stripe/configure')!
      await configure.action({ skipValidation: true } satisfies StripeConfigureArgs)
      expect(printed[0]).toMatchObject({ configured: true, provider: 'stripe' })
      const saved = await store.getCredentials('org_01TEST', 'stripe', 'user_01TEST')
      expect(saved).toMatchObject({
        accessToken: 'sk_test_from_env',
        refreshToken: '__orbit_sentinel__:stripe:api_key',
      })
      expect(saved?.refreshToken).not.toBe('__stripe_api_key__')
    } finally {
      if (prev === undefined) {
        delete process.env.ORBIT_STRIPE_API_KEY
      } else {
        process.env.ORBIT_STRIPE_API_KEY = prev
      }
    }
  })

  it('configure without any API key prints configured=false with error and does not save credentials', async () => {
    const prev = process.env.ORBIT_STRIPE_API_KEY
    delete process.env.ORBIT_STRIPE_API_KEY
    try {
      const cmds = buildStripeCommands(runtime)
      const configure = cmds.find((c) => c.name === 'stripe/configure')!
      await configure.action({ skipValidation: true } satisfies StripeConfigureArgs)
      expect(printed[0]).toMatchObject({ configured: false, provider: 'stripe' })
      const result = printed[0] as { error?: string }
      expect(result.error).toBeTruthy()
      expect(await store.getCredentials('org_01TEST', 'stripe', 'user_01TEST')).toBeNull()
    } finally {
      if (prev !== undefined) {
        process.env.ORBIT_STRIPE_API_KEY = prev
      }
    }
  })

  it('configure without --skip-validation prints configured=false with live validation error', async () => {
    const prev = process.env.ORBIT_STRIPE_API_KEY
    process.env.ORBIT_STRIPE_API_KEY = 'sk_test_no_validation'
    try {
      const cmds = buildStripeCommands(runtime)
      const configure = cmds.find((c) => c.name === 'stripe/configure')!
      await configure.action({} satisfies StripeConfigureArgs)
      expect(printed[0]).toMatchObject({ configured: false, provider: 'stripe' })
      const result = printed[0] as { error?: string }
      expect(result.error).toContain('skip-validation')
    } finally {
      if (prev === undefined) {
        delete process.env.ORBIT_STRIPE_API_KEY
      } else {
        process.env.ORBIT_STRIPE_API_KEY = prev
      }
    }
  })

  it('configure rejects API keys passed through argv', async () => {
    const cmds = buildStripeCommands(runtime)
    const configure = cmds.find((c) => c.name === 'stripe/configure')!

    await configure.action({ apiKey: 'sk_test_from_argv', skipValidation: true } satisfies StripeConfigureArgs)

    expect(printed[0]).toMatchObject({ configured: false, provider: 'stripe' })
    const result = printed[0] as { error?: string }
    expect(result.error).toContain('ORBIT_STRIPE_API_KEY')
    expect(await store.getCredentials('org_01TEST', 'stripe', 'user_01TEST')).toBeNull()
  })

  it('configure when saveCredentials throws prints configured=false with error', async () => {
    const prev = process.env.ORBIT_STRIPE_API_KEY
    process.env.ORBIT_STRIPE_API_KEY = 'sk_test_throw'
    try {
      vi.spyOn(store, 'saveCredentials').mockRejectedValueOnce(new Error('disk full'))
      const cmds = buildStripeCommands(runtime)
      const configure = cmds.find((c) => c.name === 'stripe/configure')!
      await configure.action({ skipValidation: true } satisfies StripeConfigureArgs)
      expect(printed[0]).toMatchObject({ configured: false, provider: 'stripe' })
      const result = printed[0] as { error?: string }
      expect(result.error).toBeTruthy()
    } finally {
      if (prev === undefined) {
        delete process.env.ORBIT_STRIPE_API_KEY
      } else {
        process.env.ORBIT_STRIPE_API_KEY = prev
      }
    }
  })

  it('status when no credentials prints configured=false with status not_configured', async () => {
    const cmds = buildStripeCommands(runtime)
    const status = cmds.find((c) => c.name === 'stripe/status')!
    await status.action({})
    expect(printed[0]).toMatchObject({ configured: false, status: 'not_configured', provider: 'stripe' })
  })

  it('status reports configured for Stripe API-key sentinel credentials', async () => {
    await store.saveCredentials('org_01TEST', 'stripe', 'user_01TEST', {
      accessToken: 'sk_test_saved',
      refreshToken: '__orbit_sentinel__:stripe:api_key',
    })
    const cmds = buildStripeCommands(runtime)
    const status = cmds.find((c) => c.name === 'stripe/status')!
    await status.action({})
    expect(printed[0]).toMatchObject({ configured: true, status: 'configured', provider: 'stripe' })
  })

  it('status when getCredentials throws prints configured=false with error logged', async () => {
    vi.spyOn(store, 'getCredentials').mockRejectedValueOnce(new Error('db error'))
    const cmds = buildStripeCommands(runtime)
    const status = cmds.find((c) => c.name === 'stripe/status')!
    await status.action({})
    expect(printed[0]).toMatchObject({ configured: false, provider: 'stripe' })
  })
})
