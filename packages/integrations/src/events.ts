import type { OrbitIntegrationEventBus, OrbitDomainEvent, OrbitEventHandler } from './types.js'

// Domain event types per spec section 11.1
export const DOMAIN_EVENT_TYPES = [
  'contact.created',
  'contact.updated',
  'deal.created',
  'deal.stage_moved',
  'deal.won',
  'deal.lost',
  'payment.created',
  'payment.completed',
  'activity.created',
] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

/**
 * In-memory event bus implementation.
 * MVP: exact string match for event types (no wildcards).
 *
 * ROUTING ENFORCEMENT:
 * - This bus handles INTERNAL domain events and PROVIDER inbound events only.
 * - Outbound customer webhook delivery is a SEPARATE concern handled by the API layer.
 * - There is intentionally NO mechanism to route events from this bus to outbound webhooks.
 * - Handlers registered here execute synchronously within the process — they do NOT
 *   trigger external HTTP calls to customer endpoints.
 */
export class InMemoryEventBus implements OrbitIntegrationEventBus {
  private readonly handlers = new Map<string, OrbitEventHandler[]>()

  subscribe(eventType: string, handler: OrbitEventHandler): void {
    const existing = this.handlers.get(eventType) ?? []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  async publish(event: OrbitDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? []
    for (const handler of handlers) {
      try {
        await handler(event)
      } catch (err) {
        // Log but don't stop other handlers
        console.error(
          `Event handler failed for ${event.type}:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }

  /**
   * Get the number of subscribers for a given event type.
   * Useful for testing.
   */
  subscriberCount(eventType: string): number {
    return (this.handlers.get(eventType) ?? []).length
  }

  /**
   * Clear all handlers. For testing only.
   */
  clear(): void {
    this.handlers.clear()
  }
}
