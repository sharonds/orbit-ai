import { describe, it, expect, vi } from 'vitest'
import { InMemoryEventBus, DOMAIN_EVENT_TYPES } from './events.js'
import type { OrbitDomainEvent, OrbitIntegrationEventBus } from './types.js'

function makeEvent(overrides?: Partial<OrbitDomainEvent>): OrbitDomainEvent {
  return {
    type: 'contact.created',
    organizationId: 'org_123',
    payload: { id: 'c_1', name: 'Alice' },
    occurredAt: new Date('2026-04-10T12:00:00Z'),
    ...overrides,
  }
}

describe('InMemoryEventBus', () => {
  it('publish invokes subscribed handler', async () => {
    const bus = new InMemoryEventBus()
    const handler = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockResolvedValue(undefined)
    bus.subscribe('contact.created', handler)

    const event = makeEvent()
    await bus.publish(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('publish invokes multiple handlers for same event type', async () => {
    const bus = new InMemoryEventBus()
    const handler1 = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockResolvedValue(undefined)
    const handler2 = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockResolvedValue(undefined)
    bus.subscribe('deal.created', handler1)
    bus.subscribe('deal.created', handler2)

    const event = makeEvent({ type: 'deal.created' })
    await bus.publish(event)

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('publish does NOT invoke handler for different event type (exact match only)', async () => {
    const bus = new InMemoryEventBus()
    const handler = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockResolvedValue(undefined)
    bus.subscribe('contact.created', handler)

    await bus.publish(makeEvent({ type: 'contact.updated' }))

    expect(handler).not.toHaveBeenCalled()
  })

  it('subscribe + publish round trip with OrbitDomainEvent shape', async () => {
    const bus = new InMemoryEventBus()
    const received: OrbitDomainEvent[] = []
    bus.subscribe('deal.stage_moved', async (event) => {
      received.push(event)
    })

    const event = makeEvent({
      type: 'deal.stage_moved',
      payload: { dealId: 'd_1', fromStage: 'lead', toStage: 'qualified' },
    })
    await bus.publish(event)

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(event)
  })

  it('failed handler does not block other handlers', async () => {
    const bus = new InMemoryEventBus()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const failingHandler = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockRejectedValue(new Error('boom'))
    const successHandler = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockResolvedValue(undefined)

    bus.subscribe('payment.created', failingHandler)
    bus.subscribe('payment.created', successHandler)

    await bus.publish(makeEvent({ type: 'payment.created' }))

    expect(failingHandler).toHaveBeenCalledOnce()
    expect(successHandler).toHaveBeenCalledOnce()
    expect(consoleSpy).toHaveBeenCalledWith(
      'Event handler failed for payment.created:',
      'boom',
    )

    consoleSpy.mockRestore()
  })

  it('subscriberCount returns correct count', () => {
    const bus = new InMemoryEventBus()
    expect(bus.subscriberCount('contact.created')).toBe(0)

    bus.subscribe('contact.created', async () => {})
    expect(bus.subscriberCount('contact.created')).toBe(1)

    bus.subscribe('contact.created', async () => {})
    expect(bus.subscriberCount('contact.created')).toBe(2)

    // Different event type is still 0
    expect(bus.subscriberCount('deal.created')).toBe(0)
  })

  it('clear removes all handlers', () => {
    const bus = new InMemoryEventBus()
    bus.subscribe('contact.created', async () => {})
    bus.subscribe('deal.won', async () => {})

    bus.clear()

    expect(bus.subscriberCount('contact.created')).toBe(0)
    expect(bus.subscriberCount('deal.won')).toBe(0)
  })

  it('NEGATIVE: event bus has no outbound webhook delivery methods', () => {
    const bus = new InMemoryEventBus()
    // The InMemoryEventBus must NOT have any methods that could route events externally.
    // Verify that the only public interface methods are publish, subscribe, subscriberCount, clear.
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(bus)).filter(
      (k) => k !== 'constructor',
    )
    expect(proto).toEqual(
      expect.arrayContaining(['publish', 'subscribe', 'subscriberCount', 'clear']),
    )
    expect(proto).toHaveLength(4)

    // Explicitly assert no outbound-sounding methods exist
    expect('deliverWebhook' in bus).toBe(false)
    expect('sendToCustomer' in bus).toBe(false)
    expect('notifyEndpoint' in bus).toBe(false)
    expect('dispatchWebhook' in bus).toBe(false)

    // Verify the interface contract has only publish and subscribe
    const interfaceKeys: (keyof OrbitIntegrationEventBus)[] = ['publish', 'subscribe']
    for (const key of interfaceKeys) {
      expect(typeof bus[key]).toBe('function')
    }
  })

  it('NEGATIVE: internal domain event handler cannot emit to customer webhook channel', async () => {
    const bus = new InMemoryEventBus()
    // Mock globalThis.fetch to ensure no HTTP calls are made
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('fetch should not be called'),
    )

    const handler = vi.fn<(event: OrbitDomainEvent) => Promise<void>>().mockResolvedValue(undefined)
    bus.subscribe('contact.created', handler)

    await bus.publish(makeEvent())

    // No HTTP call was made — the bus is purely in-process
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalledOnce()

    fetchSpy.mockRestore()
  })

  it('DOMAIN_EVENT_TYPES contains expected event types', () => {
    expect(DOMAIN_EVENT_TYPES).toContain('contact.created')
    expect(DOMAIN_EVENT_TYPES).toContain('deal.stage_moved')
    expect(DOMAIN_EVENT_TYPES).toContain('payment.completed')
    expect(DOMAIN_EVENT_TYPES).toHaveLength(9)
  })

  it('publish with no subscribers does not throw', async () => {
    const bus = new InMemoryEventBus()
    await expect(bus.publish(makeEvent())).resolves.toBeUndefined()
  })
})
