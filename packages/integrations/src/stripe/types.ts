import { z } from 'zod'

export const stripeConnectorConfigSchema = z.object({
  secretKeyEnv: z.string().min(1),        // env var name, NEVER the actual key
  webhookSecretEnv: z.string().min(1),    // env var name for webhook signing secret
})

export type StripeConnectorConfig = z.infer<typeof stripeConnectorConfigSchema>

export interface StripeWebhookEvent {
  id: string
  type: string
  created: number       // unix timestamp
  data: { object: Record<string, unknown> }
  livemode: boolean
}

export interface PaymentLinkInput {
  amount: number          // in cents
  currency: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface PaymentLinkResult {
  id: string
  url: string
  amount: number
  currency: string
  active: boolean
}

export interface CheckoutSessionSync {
  sessionId: string
  paymentIntentId?: string
  amount: number
  currency: string
  status: string
  customerEmail?: string
  metadata?: Record<string, unknown>
}
