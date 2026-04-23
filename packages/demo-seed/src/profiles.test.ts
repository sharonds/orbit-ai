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
  it('beta counts match the launch-gate spec (50/10/3/50/10, 14d)', () => {
    expect(TENANT_PROFILES.beta.counts).toEqual({
      contacts: 50,
      companies: 10,
      deals: 3,
      activities: 50,
      notes: 10,
    })
    expect(TENANT_PROFILES.beta.historyDays).toBe(14)
  })
  it('every profile is self-consistent: TENANT_PROFILES[k].key === k', () => {
    for (const k of Object.keys(TENANT_PROFILES) as Array<keyof typeof TENANT_PROFILES>) {
      expect(TENANT_PROFILES[k].key).toBe(k)
    }
  })
})
