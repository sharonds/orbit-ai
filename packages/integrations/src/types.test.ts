import { describe, it, expect } from 'vitest'
import type { OrbitIntegrationPlugin, IntegrationResult, OrbitDomainEvent } from './types.js'

describe('types', () => {
  it('IntegrationResult is generic', () => {
    const result: IntegrationResult<string> = { data: 'hello', provider: 'test' }
    expect(result.data).toBe('hello')
  })

  it('IntegrationResult supports optional rawResponse', () => {
    const result: IntegrationResult<number> = { data: 42, provider: 'stripe', rawResponse: {} }
    expect(result.rawResponse).toBeDefined()
  })

  it('OrbitDomainEvent shape compiles correctly', () => {
    const event: OrbitDomainEvent = {
      type: 'contact.created',
      organizationId: 'org_123',
      payload: { contactId: 'c_456' },
      occurredAt: new Date(),
    }
    expect(event.type).toBe('contact.created')
    expect(event.organizationId).toBe('org_123')
  })
})
