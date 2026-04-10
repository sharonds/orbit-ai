import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StripeConnectorConfig } from './types.js'
import { isIntegrationError } from '../errors.js'

const mockCheckoutSessionsRetrieve = vi.fn()

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: { sessions: { retrieve: mockCheckoutSessionsRetrieve } },
    })),
  }
})

vi.mock('./connector.js', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_mock'),
}))

const TEST_CONFIG: StripeConnectorConfig = {
  secretKeyEnv: 'STRIPE_SECRET_KEY',
  webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',
}

function makeMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_sync_1',
    payment_status: 'paid',
    payment_intent: { id: 'pi_sync_1', status: 'succeeded' },
    amount_total: 4200,
    currency: 'eur',
    customer_details: { email: 'test@example.com' },
    metadata: { event_id: 'evt-42' },
    ...overrides,
  }
}

describe('Stripe sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('syncStripeCheckoutSession', () => {
    async function loadSync() {
      return import('./sync.js')
    }

    it('maps session to PaymentInput shape', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(makeMockSession())

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_test_sync_1')

      expect(result.provider).toBe('stripe')
      expect(result.data.payment.amount).toBe(4200)
      expect(result.data.payment.currency).toBe('EUR')
      expect(result.data.payment.status).toBe('completed')
      expect(result.data.payment.payment_method).toBe('stripe')
      expect(result.data.payment.external_id).toBe('cs_test_sync_1')
    })

    it('maps paid status to completed', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(makeMockSession({ payment_status: 'paid' }))

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_1')
      expect(result.data.payment.status).toBe('completed')
    })

    it('maps unpaid status to pending', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(makeMockSession({ payment_status: 'unpaid' }))

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_2')
      expect(result.data.payment.status).toBe('pending')
    })

    it('maps no_payment_required to completed', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(
        makeMockSession({ payment_status: 'no_payment_required' }),
      )

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_3')
      expect(result.data.payment.status).toBe('completed')
    })

    it('sets external_id to session ID', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(makeMockSession())

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_test_sync_1')
      expect(result.data.payment.external_id).toBe('cs_test_sync_1')
    })

    it('includes stripe_session_id in metadata', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(makeMockSession())

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_test_sync_1')
      const meta = result.data.payment.metadata as Record<string, unknown>
      expect(meta['stripe_session_id']).toBe('cs_test_sync_1')
      expect(meta['stripe_payment_intent']).toBe('pi_sync_1')
      expect(meta['stripe_customer_email']).toBe('test@example.com')
    })

    it('builds CheckoutSessionSync with paymentIntentId from expanded object', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(makeMockSession())

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_test_sync_1')
      expect(result.data.session.paymentIntentId).toBe('pi_sync_1')
      expect(result.data.session.customerEmail).toBe('test@example.com')
      expect(result.data.session.metadata).toEqual({ event_id: 'evt-42' })
    })

    it('handles session without customer email', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(
        makeMockSession({ customer_details: null }),
      )

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_no_email')
      expect(result.data.session.customerEmail).toBeUndefined()
    })

    it('handles string payment_intent (not expanded)', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockResolvedValue(
        makeMockSession({ payment_intent: 'pi_string_only' }),
      )

      const result = await syncStripeCheckoutSession(TEST_CONFIG, 'cs_str_pi')
      // String payment_intent means it wasn't expanded — paymentIntentId not set on session sync
      expect(result.data.session.paymentIntentId).toBeUndefined()
    })

    it('maps errors to IntegrationError', async () => {
      const { syncStripeCheckoutSession } = await loadSync()
      mockCheckoutSessionsRetrieve.mockRejectedValue(new Error('Session not found'))

      try {
        await syncStripeCheckoutSession(TEST_CONFIG, 'cs_missing')
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.provider).toBe('stripe')
        }
      }
    })
  })
})
