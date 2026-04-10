import Stripe from 'stripe'
import type { StripeConnectorConfig, PaymentLinkInput, PaymentLinkResult } from './types.js'
import type { IntegrationResult } from '../types.js'
import { toIntegrationError } from '../errors.js'
import { getStripeSecretKey } from './connector.js'

function createStripeClient(config: StripeConnectorConfig): Stripe {
  return new Stripe(getStripeSecretKey(config))
}

export async function createPaymentLink(
  config: StripeConnectorConfig,
  input: PaymentLinkInput,
): Promise<IntegrationResult<PaymentLinkResult>> {
  try {
    const stripe = createStripeClient(config)
    // Create a price for the payment link
    const price = await stripe.prices.create({
      currency: input.currency,
      unit_amount: input.amount,
      product_data: { name: input.description ?? 'Payment' },
    })
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      ...(input.metadata != null ? { metadata: input.metadata as Stripe.MetadataParam } : {}),
    })
    return {
      data: {
        id: link.id,
        url: link.url,
        amount: input.amount,
        currency: input.currency,
        active: link.active,
      },
      provider: 'stripe',
      rawResponse: link,
    }
  } catch (err) {
    throw toIntegrationError(err, 'stripe')
  }
}

export async function getPaymentStatus(
  config: StripeConnectorConfig,
  sessionId: string,
): Promise<IntegrationResult<{ status: string; paymentIntentId?: string; amount?: number; currency?: string }>> {
  try {
    const stripe = createStripeClient(config)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return {
      data: {
        status: session.payment_status,
        ...(session.payment_intent
          ? { paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id }
          : {}),
        ...(session.amount_total != null ? { amount: session.amount_total } : {}),
        ...(session.currency != null ? { currency: session.currency } : {}),
      },
      provider: 'stripe',
      rawResponse: session,
    }
  } catch (err) {
    throw toIntegrationError(err, 'stripe')
  }
}
