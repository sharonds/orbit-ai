import { describe, it, expect } from 'vitest'
import { TENANT_PROFILES } from './profiles.js'

describe('TENANT_PROFILES', () => {
  it('acme counts match the launch-gate spec (200/40/15/300/50, 30d)', () => {
    expect(TENANT_PROFILES.acme.counts).toEqual({
      contacts: 200,
      companies: 40,
      deals: 15,
      activities: 300,
      notes: 50,
    })
    expect(TENANT_PROFILES.acme.historyDays).toBe(30)
  })
  it('beta is sparser than acme and has a distinct slug', () => {
    expect(TENANT_PROFILES.beta.counts.contacts).toBeLessThan(TENANT_PROFILES.acme.counts.contacts)
    expect(TENANT_PROFILES.acme.organizationSlug).not.toEqual(TENANT_PROFILES.beta.organizationSlug)
  })
})
