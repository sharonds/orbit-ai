import { describe, expect, it } from 'vitest'

import { assertTenantPatchOrganizationInvariant } from './tenant-guards.js'

describe('tenant repository guards', () => {
  it('allows updates that do not mention organizationId', () => {
    expect(() =>
      assertTenantPatchOrganizationInvariant('org_01ARYZ6S41YYYYYYYYYYYYYYYY', {
        name: 'Updated',
      }),
    ).not.toThrow()
  })

  it('allows updates that preserve organizationId', () => {
    expect(() =>
      assertTenantPatchOrganizationInvariant('org_01ARYZ6S41YYYYYYYYYYYYYYYY', {
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).not.toThrow()
  })

  it('rejects updates that try to move a tenant record across organizations', () => {
    expect(() =>
      assertTenantPatchOrganizationInvariant('org_01ARYZ6S41YYYYYYYYYYYYYYYY', {
        organizationId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      }),
    ).toThrow('Tenant record organization mismatch')
  })
})
