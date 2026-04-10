import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StripeConnectorConfig } from './types.js'
import { isIntegrationError } from '../errors.js'

// Mock Stripe constructor and methods
const mockPricesCreate = vi.fn()
const mockPaymentLinksCreate = vi.fn()
const mockCheckoutSessionsRetrieve = vi.fn()

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      prices: { create: mockPricesCreate },
      paymentLinks: { create: mockPaymentLinksCreate },
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

describe('Stripe operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPaymentLink', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('creates a price and payment link, returns correct shape', async () => {
      const { createPaymentLink } = await loadOps()
      mockPricesCreate.mockResolvedValue({ id: 'price_123' })
      mockPaymentLinksCreate.mockResolvedValue({
        id: 'plink_456',
        url: 'https://buy.stripe.com/test_456',
        active: true,
      })

      const result = await createPaymentLink(TEST_CONFIG, {
        amount: 2500,
        currency: 'eur',
        description: 'Event Ticket',
      })

      expect(result.provider).toBe('stripe')
      expect(result.data).toEqual({
        id: 'plink_456',
        url: 'https://buy.stripe.com/test_456',
        amount: 2500,
        currency: 'eur',
        active: true,
      })
      expect(result.rawResponse).toBeDefined()

      // Verify price was created with correct params
      expect(mockPricesCreate).toHaveBeenCalledWith({
        currency: 'eur',
        unit_amount: 2500,
        product_data: { name: 'Event Ticket' },
      })

      // Verify payment link was created with the price
      expect(mockPaymentLinksCreate).toHaveBeenCalledWith({
        line_items: [{ price: 'price_123', quantity: 1 }],
      })
    })

    it('passes metadata when provided', async () => {
      const { createPaymentLink } = await loadOps()
      mockPricesCreate.mockResolvedValue({ id: 'price_789' })
      mockPaymentLinksCreate.mockResolvedValue({
        id: 'plink_abc',
        url: 'https://buy.stripe.com/test_abc',
        active: true,
      })

      await createPaymentLink(TEST_CONFIG, {
        amount: 1000,
        currency: 'usd',
        metadata: { event_id: 'evt-1', org: 'org-1' },
      })

      expect(mockPaymentLinksCreate).toHaveBeenCalledWith({
        line_items: [{ price: 'price_789', quantity: 1 }],
        metadata: { event_id: 'evt-1', org: 'org-1' },
      })
    })

    it('uses default description when none provided', async () => {
      const { createPaymentLink } = await loadOps()
      mockPricesCreate.mockResolvedValue({ id: 'price_def' })
      mockPaymentLinksCreate.mockResolvedValue({
        id: 'plink_def',
        url: 'https://buy.stripe.com/test_def',
        active: true,
      })

      await createPaymentLink(TEST_CONFIG, {
        amount: 500,
        currency: 'usd',
      })

      expect(mockPricesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ product_data: { name: 'Payment' } }),
      )
    })

    it('maps Stripe errors to IntegrationError', async () => {
      const { createPaymentLink } = await loadOps()
      mockPricesCreate.mockRejectedValue(new Error('Invalid API Key provided'))

      try {
        await createPaymentLink(TEST_CONFIG, { amount: 100, currency: 'usd' })
        expect.fail('should have thrown')
      } catch (err) {
        expect(isIntegrationError(err)).toBe(true)
        if (isIntegrationError(err)) {
          expect(err.provider).toBe('stripe')
          expect(err.code).toBe('PROVIDER_ERROR')
          expect(err.message).toContain('Invalid API Key')
        }
      }
    })
  })

  describe('getPaymentStatus', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('retrieves session and returns status', async () => {
      const { getPaymentStatus } = await loadOps()
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test_session',
        payment_status: 'paid',
        payment_intent: 'pi_123',
        amount_total: 5000,
        currency: 'eur',
      })

      const result = await getPaymentStatus(TEST_CONFIG, 'cs_test_session')

      expect(result.provider).toBe('stripe')
      expect(result.data.status).toBe('paid')
      expect(result.data.paymentIntentId).toBe('pi_123')
      expect(result.data.amount).toBe(5000)
      expect(result.data.currency).toBe('eur')
    })

    it('handles session with no payment intent', async () => {
      const { getPaymentStatus } = await loadOps()
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test_nopi',
        payment_status: 'unpaid',
        payment_intent: null,
        amount_total: null,
        currency: null,
      })

      const result = await getPaymentStatus(TEST_CONFIG, 'cs_test_nopi')

      expect(result.data.status).toBe('unpaid')
      expect(result.data.paymentIntentId).toBeUndefined()
      expect(result.data.amount).toBeUndefined()
      expect(result.data.currency).toBeUndefined()
    })

    it('handles expanded payment intent object', async () => {
      const { getPaymentStatus } = await loadOps()
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test_expanded',
        payment_status: 'paid',
        payment_intent: { id: 'pi_expanded_456', status: 'succeeded' },
        amount_total: 3000,
        currency: 'usd',
      })

      const result = await getPaymentStatus(TEST_CONFIG, 'cs_test_expanded')

      expect(result.data.paymentIntentId).toBe('pi_expanded_456')
    })

    it('maps errors to IntegrationError', async () => {
      const { getPaymentStatus } = await loadOps()
      mockCheckoutSessionsRetrieve.mockRejectedValue(new Error('No such checkout session'))

      try {
        await getPaymentStatus(TEST_CONFIG, 'cs_nonexistent')
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
