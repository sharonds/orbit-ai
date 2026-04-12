import Stripe from 'stripe'
import type { StripeConnectorConfig, CheckoutSessionSync } from './types.js'
import type { IntegrationResult } from '../types.js'
import { toIntegrationError } from '../errors.js'
import { getStripeSecretKey } from './connector.js'

export interface PaymentInput {
  amount: number
  currency: string
  status: string
  payment_method?: string
  external_id?: string
  metadata?: Record<string, unknown>
  contact_id?: string
  deal_id?: string
}

/**
 * Sync a Stripe checkout session into an Orbit payment input.
 */
export async function syncStripeCheckoutSession(
  config: StripeConnectorConfig,
  sessionId: string,
): Promise<IntegrationResult<{ payment: PaymentInput; session: CheckoutSessionSync }>> {
  try {
    const stripe = new Stripe(getStripeSecretKey(config))
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    })

    const checkoutSync: CheckoutSessionSync = {
      sessionId: session.id,
      ...(session.payment_intent && typeof session.payment_intent !== 'string'
        ? { paymentIntentId: session.payment_intent.id }
        : {}),
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: session.payment_status,
      ...(session.customer_details?.email != null ? { customerEmail: session.customer_details.email } : {}),
      ...(session.metadata != null ? { metadata: session.metadata as Record<string, unknown> } : {}),
    }

    const payment: PaymentInput = {
      amount: checkoutSync.amount,
      currency: checkoutSync.currency.toUpperCase(),
      status: mapStripeStatus(session.payment_status),
      payment_method: 'stripe',
      external_id: session.id,
      metadata: {
        stripe_session_id: session.id,
        ...(checkoutSync.paymentIntentId != null ? { stripe_payment_intent: checkoutSync.paymentIntentId } : {}),
        ...(checkoutSync.customerEmail != null ? { stripe_customer_email: checkoutSync.customerEmail } : {}),
      },
    }

    return { data: { payment, session: checkoutSync }, provider: 'stripe', rawResponse: session }
  } catch (err) {
    throw toIntegrationError(err, 'stripe')
  }
}

function mapStripeStatus(status: string): string {
  switch (status) {
    case 'paid': return 'completed'
    case 'unpaid': return 'pending'
    case 'no_payment_required': return 'completed'
    default: return 'pending'
  }
}
