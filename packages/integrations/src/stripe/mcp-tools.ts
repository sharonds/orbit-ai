import { z } from 'zod'
import type { IntegrationTool, IntegrationCommand } from '../types.js'
import { createPaymentLink, getPaymentStatus } from './operations.js'
import { syncStripeCheckoutSession } from './sync.js'
import type { StripeConnectorConfig } from './types.js'
import { toIntegrationError } from '../errors.js'

export interface StripeToolContext {
  config: StripeConnectorConfig
}

/**
 * Build Stripe MCP tools. All tool names MUST start with 'integrations.'.
 */
export function buildStripeTools(context: StripeToolContext): IntegrationTool[] {
  return [
    {
      name: 'integrations.stripe.create_payment_link',
      title: 'Create Stripe Payment Link',
      description: 'Create a Stripe payment link for collecting payments',
      inputSchema: z.object({
        amount: z.number().int().positive(),
        currency: z.string().length(3),
        description: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        try {
          const description = args['description'] as string | undefined
          const result = await createPaymentLink(context.config, {
            amount: args['amount'] as number,
            currency: args['currency'] as string,
            ...(description !== undefined ? { description } : {}),
          })
          return result.data
        } catch (err) {
          throw toIntegrationError(err, 'stripe')
        }
      },
    },
    {
      name: 'integrations.stripe.get_payment_status',
      title: 'Get Payment Status',
      description: 'Check the status of a Stripe checkout session',
      inputSchema: z.object({
        session_id: z.string(),
      }),
      async execute(args: Record<string, unknown>) {
        try {
          const result = await getPaymentStatus(context.config, args['session_id'] as string)
          return result.data
        } catch (err) {
          throw toIntegrationError(err, 'stripe')
        }
      },
    },
  ]
}

/**
 * CLI commands for Stripe — under 'orbit integrations stripe' namespace.
 * Do NOT register top-level 'orbit payments' alias — that's owned by core.
 */
export function buildStripeCommands(context: StripeToolContext): IntegrationCommand[] {
  return [
    {
      name: 'link-create',
      description: 'Create a Stripe payment link',
      options: [
        { flags: '-a, --amount <cents>', description: 'Amount in cents' },
        { flags: '-c, --currency <code>', description: 'Currency code (e.g., usd)', defaultValue: 'usd' },
        { flags: '-d, --description <text>', description: 'Payment description' },
      ],
      async action(...args: unknown[]) {
        const opts = args[args.length - 1] as Record<string, string>
        const amount = Number(opts['amount'])
        if (!Number.isFinite(amount) || amount <= 0) {
          console.error('Error: --amount must be a positive number (in cents)')
          return
        }
        try {
          const description = opts['description'] as string | undefined
          const result = await createPaymentLink(context.config, {
            amount,
            currency: opts['currency'] ?? 'usd',
            ...(description !== undefined ? { description } : {}),
          })
          console.log(JSON.stringify(result.data, null, 2))
        } catch (err) {
          throw toIntegrationError(err, 'stripe')
        }
      },
    },
    {
      name: 'sync',
      description: 'Sync a Stripe checkout session to Orbit',
      options: [
        { flags: '-s, --session-id <id>', description: 'Stripe checkout session ID' },
      ],
      async action(...args: unknown[]) {
        const opts = args[args.length - 1] as Record<string, string>
        try {
          const sessionId = opts['sessionId'] ?? opts['session-id']
          if (!sessionId) {
            console.error('--session-id is required')
            return
          }
          const result = await syncStripeCheckoutSession(context.config, sessionId)
          console.log(JSON.stringify(result.data, null, 2))
        } catch (err) {
          throw toIntegrationError(err, 'stripe')
        }
      },
    },
  ]
}
