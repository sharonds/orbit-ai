import Stripe from 'stripe'
import type { StripeConnectorConfig, StripeWebhookEvent } from './types.js'
import { syncStripeCheckoutSession, type PaymentInput } from './sync.js'
import { createIntegrationError, toIntegrationError } from '../errors.js'

const MAX_PROCESSED_IDS = 1000

export interface WebhookProcessingState {
  processedEventIds: string[]
}

/**
 * Verify Stripe webhook signature.
 * Uses Stripe's constructEvent which handles both signature verification
 * and replay window (tolerance parameter, default 300s).
 * Do NOT add a separate timestamp check.
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string,
  tolerance?: number,
): StripeWebhookEvent {
  try {
    const stripe = new Stripe('unused') // Only needed for constructEvent
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      secret,
      tolerance,
    ) as unknown as StripeWebhookEvent
    return event
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw createIntegrationError('WEBHOOK_SIGNATURE_INVALID', `Webhook verification failed: ${message}`, { provider: 'stripe', cause: err })
  }
}

/**
 * Check if an event has already been processed (idempotency).
 * Returns true if duplicate.
 */
export function isDuplicateEvent(eventId: string, state: WebhookProcessingState): boolean {
  return state.processedEventIds.includes(eventId)
}

/**
 * Record a processed event ID with FIFO eviction at MAX_PROCESSED_IDS.
 */
export function recordProcessedEvent(eventId: string, state: WebhookProcessingState): void {
  if (state.processedEventIds.length >= MAX_PROCESSED_IDS) {
    state.processedEventIds.shift() // Remove oldest
  }
  state.processedEventIds.push(eventId)
}

// Supported event types for routing
const HANDLED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
])

export interface WebhookResult {
  handled: boolean
  eventId: string
  eventType: string
  payment?: PaymentInput
  duplicate: boolean
}

/**
 * Handle a verified Stripe webhook event.
 * Routes by event type. Provider events flow through the internal event bus only —
 * they must NOT be routed to outbound customer webhook delivery.
 */
export async function handleStripeEvent(
  config: StripeConnectorConfig,
  event: StripeWebhookEvent,
  state: WebhookProcessingState,
): Promise<WebhookResult> {
  // Dedup check
  if (isDuplicateEvent(event.id, state)) {
    return { handled: false, eventId: event.id, eventType: event.type, duplicate: true }
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return { handled: false, eventId: event.id, eventType: event.type, duplicate: false }
  }

  try {
    let payment: PaymentInput | undefined

    switch (event.type) {
      case 'checkout.session.completed': {
        const sessionId = (event.data.object as Record<string, unknown>)['id'] as string
        if (sessionId) {
          const result = await syncStripeCheckoutSession(config, sessionId)
          payment = result.data.payment
        }
        break
      }
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'invoice.paid':
      case 'invoice.payment_failed':
        // These are handled but don't produce a PaymentInput (yet)
        break
      default:
        // assertNever pattern — but HANDLED_EVENT_TYPES.has already filters
        break
    }

    // Record as processed (FIFO eviction)
    recordProcessedEvent(event.id, state)

    return {
      handled: true,
      eventId: event.id,
      eventType: event.type,
      ...(payment != null ? { payment } : {}),
      duplicate: false,
    }
  } catch (err) {
    throw toIntegrationError(err, 'stripe')
  }
}
