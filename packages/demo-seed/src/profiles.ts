export interface ProfileCounts {
  readonly contacts: number
  readonly companies: number
  readonly deals: number
  readonly activities: number
  readonly notes: number
}

export interface TenantProfile {
  readonly key: 'acme' | 'beta'
  readonly organizationName: string
  readonly organizationSlug: string
  readonly counts: ProfileCounts
  readonly historyDays: number
  readonly randomSeed: string
}

export const TENANT_PROFILES: Record<'acme' | 'beta', TenantProfile> = {
  acme: {
    key: 'acme',
    organizationName: 'Acme Events',
    organizationSlug: 'acme-events',
    counts: { contacts: 200, companies: 40, deals: 15, activities: 300, notes: 50 },
    historyDays: 30,
    randomSeed: 'acme-v1',
  },
  beta: {
    key: 'beta',
    organizationName: 'Beta Collective',
    organizationSlug: 'beta-collective',
    counts: { contacts: 50, companies: 10, deals: 3, activities: 50, notes: 10 },
    historyDays: 14,
    randomSeed: 'beta-v1',
  },
} as const
