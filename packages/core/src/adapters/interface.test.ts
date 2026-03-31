import { describe, expect, it } from 'vitest'

import { DEFAULT_ADAPTER_AUTHORITY_MODEL, type ApiKeyAuthLookup } from './interface.js'

describe('adapter authority model', () => {
  it('declares runtime and migration authority as separate modes', () => {
    expect(DEFAULT_ADAPTER_AUTHORITY_MODEL.runtimeAuthority).toBe('request-scoped')
    expect(DEFAULT_ADAPTER_AUTHORITY_MODEL.migrationAuthority).toBe('elevated')
    expect(DEFAULT_ADAPTER_AUTHORITY_MODEL.requestPathMayUseElevatedCredentials).toBe(false)
  })

  it('keeps the auth lookup DTO minimal', () => {
    const lookup: ApiKeyAuthLookup = {
      id: 'key_01ABCDEF0123456789ABCDEF01',
      organizationId: 'org_01ABCDEF0123456789ABCDEF01',
      permissions: ['contacts:read'],
      revokedAt: null,
      expiresAt: null,
    }

    expect(Object.keys(lookup).sort()).toEqual([
      'expiresAt',
      'id',
      'organizationId',
      'permissions',
      'revokedAt',
    ])
  })
})
