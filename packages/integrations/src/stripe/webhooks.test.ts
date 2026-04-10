import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StripeConnectorConfig, StripeWebhookEvent } from './types.js'
import { isIntegrationError } from '../errors.js'

// --- Mocks ---

const mockConstructEvent = vi.fn()
const mockCheckoutSessionsRetrieve = vi.fn()

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: { constructEvent: mockConstructEvent },
      checkout: { sessions: { retrieve: mockCheckoutSessionsRetrieve } },
    })),
  }
})

vi.mock('./connector.js', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_mock'),
}))

// --- Helpers ---

const TEST_CONFIG: StripeConnectorConfig = {
  secretKeyEnv: 'STRIPE_SECRET_KEY',
  webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',
}

function makeWebhookEvent(overrides: Partial<StripeWebhookEvent> = {}): StripeWebhookEvent {
  return {
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'cs_test_1', amount_total: 5000, currency: 'usd' } },
    livemode: false,
    ...overrides,
  }
}

function freshState() {
  return { processedEventIds: [] as string[] }
}

// --- Tests ---

describe('Stripe webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyStripeWebhook', () => {
    async function loadWebhooks() {
      return import('./webhooks.js')
    }

    it('returns event on valid signature', async () => {
      const { verifyStripeWebhook } = await loadWebhooks()
      const expectedEvent = makeWebhookEvent()
      mockConstructEvent.mockReturnValue(expectedEvent)

      const result = verifyStripeWebhook('payload', 'sig_valid', 'whsec_test')

      expect(result.id).toBe('evt_test_1')
      expect(result.type).toBe('checkout.session.completed')
      expect(mockConstructEvent).toHaveBeenCalledWith('payload', 'sig_valid', 'whsec_test', undefined)
    })

    it('throws WEBHOOK_SIGNATURE_INVALID on invalid signature', async () => {
      const { verifyStripeWebhook } = await loadWebhooks()
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload.')
      })

      try {
        verifyStripeWebhook('payload', 'sig_bad', 'whsec_test')
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('WEBHOOK_SIGNATURE_INVALID')
          expect(err.provider).toBe('stripe')
          expect(err.message).toContain('Webhook verification failed')
        }
      }
    })

    it('rejects event outside tolerance window (replay prevention)', async () => {
      const { verifyStripeWebhook } = await loadWebhooks()
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Timestamp outside the tolerance zone')
      })

      try {
        verifyStripeWebhook('old_payload', 'sig_old', 'whsec_test', 300)
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.code).toBe('WEBHOOK_SIGNATURE_INVALID')
          expect(err.message).toContain('Timestamp outside the tolerance zone')
        }
      }
    })

    it('passes tolerance parameter to constructEvent', async () => {
      const { verifyStripeWebhook } = await loadWebhooks()
      mockConstructEvent.mockReturnValue(makeWebhookEvent())

      verifyStripeWebhook('payload', 'sig', 'whsec', 600)

      expect(mockConstructEvent).toHaveBeenCalledWith('payload', 'sig', 'whsec', 600)
    })
  })

  describe('isDuplicateEvent', () => {
    async function loadWebhooks() {
      return import('./webhooks.js')
    }

    it('returns false for new event', async () => {
      const { isDuplicateEvent } = await loadWebhooks()
      const state = freshState()

      expect(isDuplicateEvent('evt_new', state)).toBe(false)
    })

    it('returns true for already-seen event', async () => {
      const { isDuplicateEvent } = await loadWebhooks()
      const state = freshState()
      state.processedEventIds.push('evt_seen')

      expect(isDuplicateEvent('evt_seen', state)).toBe(true)
    })
  })

  describe('recordProcessedEvent', () => {
    async function loadWebhooks() {
      return import('./webhooks.js')
    }

    it('adds event ID to state', async () => {
      const { recordProcessedEvent } = await loadWebhooks()
      const state = freshState()

      recordProcessedEvent('evt_1', state)

      expect(state.processedEventIds).toContain('evt_1')
    })

    it('enforces FIFO eviction at 1000 entries', async () => {
      const { recordProcessedEvent } = await loadWebhooks()
      const state = freshState()

      // Fill with 1000 entries
      for (let i = 0; i < 1000; i++) {
        state.processedEventIds.push(`evt_fill_${i}`)
      }
      expect(state.processedEventIds).toHaveLength(1000)

      // Adding one more should evict the oldest
      recordProcessedEvent('evt_overflow', state)

      expect(state.processedEventIds).toHaveLength(1000)
      expect(state.processedEventIds).not.toContain('evt_fill_0')
      expect(state.processedEventIds).toContain('evt_overflow')
      expect(state.processedEventIds[state.processedEventIds.length - 1]).toBe('evt_overflow')
    })
  })

  describe('handleStripeEvent', () => {
    async function loadWebhooks() {
      return import('./webhooks.js')
    }

    it('duplicate event ID returns duplicate: true, handled: false', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()
      state.processedEventIds.push('evt_dup')

      const event = makeWebhookEvent({ id: 'evt_dup' })
      const result = await handleStripeEvent(TEST_CONFIG, event, state)

      expect(result.duplicate).toBe(true)
      expect(result.handled).toBe(false)
      expect(result.eventId).toBe('evt_dup')
    })

    it('routes checkout.session.completed to syncStripeCheckoutSession', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()

      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test_1',
        payment_status: 'paid',
        payment_intent: { id: 'pi_1', status: 'succeeded' },
        amount_total: 5000,
        currency: 'usd',
        customer_details: { email: 'buyer@test.com' },
        metadata: {},
      })

      const event = makeWebhookEvent({
        id: 'evt_checkout_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1' } },
      })

      const result = await handleStripeEvent(TEST_CONFIG, event, state)

      expect(result.handled).toBe(true)
      expect(result.duplicate).toBe(false)
      expect(result.payment).toBeDefined()
      expect(result.payment!.amount).toBe(5000)
      expect(result.payment!.currency).toBe('USD')
      expect(result.payment!.status).toBe('completed')
      expect(mockCheckoutSessionsRetrieve).toHaveBeenCalledWith('cs_test_1', { expand: ['payment_intent'] })
    })

    it('returns handled: false for unknown event type', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()

      const event = makeWebhookEvent({
        id: 'evt_unknown',
        type: 'customer.subscription.created',
      })

      const result = await handleStripeEvent(TEST_CONFIG, event, state)

      expect(result.handled).toBe(false)
      expect(result.duplicate).toBe(false)
      expect(result.eventType).toBe('customer.subscription.created')
    })

    it('records event ID after successful handling', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()

      const event = makeWebhookEvent({
        id: 'evt_record_1',
        type: 'payment_intent.succeeded',
      })

      await handleStripeEvent(TEST_CONFIG, event, state)

      expect(state.processedEventIds).toContain('evt_record_1')
    })

    it('handles payment_intent.succeeded without payment output', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()

      const event = makeWebhookEvent({
        id: 'evt_pi_1',
        type: 'payment_intent.succeeded',
      })

      const result = await handleStripeEvent(TEST_CONFIG, event, state)

      expect(result.handled).toBe(true)
      expect(result.payment).toBeUndefined()
    })

    it('throws IntegrationError when sync fails', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()

      mockCheckoutSessionsRetrieve.mockRejectedValue(new Error('Stripe API down'))

      const event = makeWebhookEvent({
        id: 'evt_fail_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_fail' } },
      })

      try {
        await handleStripeEvent(TEST_CONFIG, event, state)
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.provider).toBe('stripe')
        }
      }
    })

    it('result does NOT contain any outbound customer delivery flag', async () => {
      const { handleStripeEvent } = await loadWebhooks()
      const state = freshState()

      const event = makeWebhookEvent({
        id: 'evt_no_outbound',
        type: 'invoice.paid',
      })

      const result = await handleStripeEvent(TEST_CONFIG, event, state)

      // Provider webhook events must NOT route through outbound customer webhook delivery
      expect(result).not.toHaveProperty('deliverToCustomer')
      expect(result).not.toHaveProperty('outbound')
      expect(result).not.toHaveProperty('webhook_url')
      expect(result).not.toHaveProperty('customerWebhook')

      // Verify the result shape has only expected keys
      const keys = Object.keys(result).sort()
      expect(keys).toEqual(['duplicate', 'eventId', 'eventType', 'handled'].sort())
    })
  })
})
