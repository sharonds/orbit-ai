import { describe, it, expect, vi } from 'vitest'
import { buildStripeTools, buildStripeCommands, type StripeToolContext } from './mcp-tools.js'
import type { StripeConnectorConfig } from './types.js'

// Mock operations
vi.mock('./operations.js', () => ({
  createPaymentLink: vi.fn(async () => ({
    data: { id: 'plink_123', url: 'https://pay.stripe.com/test', amount: 2500, currency: 'usd', active: true },
    provider: 'stripe',
  })),
  getPaymentStatus: vi.fn(async () => ({
    data: { status: 'paid', paymentIntentId: 'pi_123', amount: 2500, currency: 'usd' },
    provider: 'stripe',
  })),
}))

// Mock sync
vi.mock('./sync.js', () => ({
  syncStripeCheckoutSession: vi.fn(async () => ({
    data: {
      payment: { amount: 2500, currency: 'USD', status: 'completed', payment_method: 'stripe', external_id: 'cs_123' },
      session: { sessionId: 'cs_123', amount: 2500, currency: 'usd', status: 'paid' },
    },
    provider: 'stripe',
  })),
}))

function makeContext(): StripeToolContext {
  const config: StripeConnectorConfig = {
    secretKeyEnv: 'STRIPE_SECRET_KEY',
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',
  }
  return { config }
}

describe('buildStripeTools', () => {
  it('returns 2 tools', () => {
    const tools = buildStripeTools(makeContext())
    expect(tools).toHaveLength(2)
  })

  it('all tool names start with integrations.', () => {
    const tools = buildStripeTools(makeContext())
    for (const tool of tools) {
      expect(tool.name).toMatch(/^integrations\./)
    }
  })

  it('has create_payment_link tool with correct name', () => {
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.create_payment_link')
    expect(tool).toBeDefined()
    expect(tool!.description).toBe('Create a Stripe payment link for collecting payments')
  })

  it('has get_payment_status tool with correct name', () => {
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.get_payment_status')
    expect(tool).toBeDefined()
    expect(tool!.description).toBe('Check the status of a Stripe checkout session')
  })

  it('create_payment_link inputSchema validates correctly', () => {
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.create_payment_link')!
    const parsed = tool.inputSchema.parse({ amount: 2500, currency: 'usd' })
    expect(parsed).toEqual({ amount: 2500, currency: 'usd' })
  })

  it('create_payment_link inputSchema rejects invalid currency length', () => {
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.create_payment_link')!
    expect(() => tool.inputSchema.parse({ amount: 2500, currency: 'dollars' })).toThrow()
  })

  it('get_payment_status inputSchema validates correctly', () => {
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.get_payment_status')!
    const parsed = tool.inputSchema.parse({ session_id: 'cs_123' })
    expect(parsed).toEqual({ session_id: 'cs_123' })
  })

  it('create_payment_link execute calls createPaymentLink and returns data', async () => {
    const { createPaymentLink } = await import('./operations.js')
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.create_payment_link')!

    const result = await tool.execute({ amount: 2500, currency: 'usd' })

    expect(createPaymentLink).toHaveBeenCalled()
    expect(result).toEqual({
      id: 'plink_123',
      url: 'https://pay.stripe.com/test',
      amount: 2500,
      currency: 'usd',
      active: true,
    })
  })

  it('get_payment_status execute calls getPaymentStatus and returns data', async () => {
    const { getPaymentStatus } = await import('./operations.js')
    const tools = buildStripeTools(makeContext())
    const tool = tools.find((t) => t.name === 'integrations.stripe.get_payment_status')!

    const result = await tool.execute({ session_id: 'cs_123' })

    expect(getPaymentStatus).toHaveBeenCalled()
    expect(result).toEqual({ status: 'paid', paymentIntentId: 'pi_123', amount: 2500, currency: 'usd' })
  })
})

describe('buildStripeCommands', () => {
  it('returns 2 commands', () => {
    const commands = buildStripeCommands(makeContext())
    expect(commands).toHaveLength(2)
  })

  it('command names are link-create and sync', () => {
    const commands = buildStripeCommands(makeContext())
    const names = commands.map((c) => c.name)
    expect(names).toEqual(['link-create', 'sync'])
  })

  it('commands are under integrations namespace (NOT top-level orbit payments)', () => {
    const commands = buildStripeCommands(makeContext())
    // Verify no command uses 'payments' as its name — they are subcommands under stripe
    for (const cmd of commands) {
      expect(cmd.name).not.toBe('payments')
    }
  })

  it('link-create command has correct options', () => {
    const commands = buildStripeCommands(makeContext())
    const linkCreate = commands.find((c) => c.name === 'link-create')!
    expect(linkCreate.options).toBeDefined()
    expect(linkCreate.options!.length).toBe(3)
    expect(linkCreate.options!.map((o) => o.flags)).toEqual([
      '-a, --amount <cents>',
      '-c, --currency <code>',
      '-d, --description <text>',
    ])
  })

  it('link-create command has usd as default currency', () => {
    const commands = buildStripeCommands(makeContext())
    const linkCreate = commands.find((c) => c.name === 'link-create')!
    const currencyOpt = linkCreate.options!.find((o) => o.flags.includes('--currency'))
    expect(currencyOpt!.defaultValue).toBe('usd')
  })

  it('sync command has correct options', () => {
    const commands = buildStripeCommands(makeContext())
    const syncCmd = commands.find((c) => c.name === 'sync')!
    expect(syncCmd.options).toBeDefined()
    expect(syncCmd.options!.length).toBe(1)
    expect(syncCmd.options![0].flags).toBe('-s, --session-id <id>')
  })

  it('link-create action calls createPaymentLink', async () => {
    const { createPaymentLink } = await import('./operations.js')
    const commands = buildStripeCommands(makeContext())
    const linkCreate = commands.find((c) => c.name === 'link-create')!

    // Spy on console.log to suppress output
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await linkCreate.action({ amount: '2500', currency: 'usd', description: 'Test payment' })
    logSpy.mockRestore()

    expect(createPaymentLink).toHaveBeenCalled()
  })

  it('sync action calls syncStripeCheckoutSession', async () => {
    const { syncStripeCheckoutSession } = await import('./sync.js')
    const commands = buildStripeCommands(makeContext())
    const syncCmd = commands.find((c) => c.name === 'sync')!

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await syncCmd.action({ sessionId: 'cs_123' })
    logSpy.mockRestore()

    expect(syncStripeCheckoutSession).toHaveBeenCalled()
  })

  it('sync action logs error when session-id is missing', async () => {
    const commands = buildStripeCommands(makeContext())
    const syncCmd = commands.find((c) => c.name === 'sync')!

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await syncCmd.action({})
    expect(errorSpy).toHaveBeenCalledWith('--session-id is required')
    errorSpy.mockRestore()
  })

  it('link-create prints error and returns when amount is missing/NaN', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const commands = buildStripeCommands(makeContext())
    const linkCreate = commands.find((c) => c.name === 'link-create')!

    // Simulate Commander passing opts with missing amount
    await linkCreate.action({ currency: 'usd' })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('--amount must be a positive number'),
    )
    consoleSpy.mockRestore()
  })
})
