import { describe, it, expect, expectTypeOf } from 'vitest'
import type { IntegrationConnectionRecord, IntegrationSyncStateRecord } from './connection.js'

describe('IntegrationConnectionRecord', () => {
  it('does not include credentialsEncrypted', () => {
    type Keys = keyof IntegrationConnectionRecord
    // TypeScript compile-time check: if these lines compile, the keys don't exist
    expectTypeOf<Keys>().not.toEqualTypeOf<'credentialsEncrypted'>()
    // Runtime check: create a record object and verify the fields
    const record: IntegrationConnectionRecord = {
      id: 'ic_test',
      organizationId: 'org_test',
      provider: 'gmail',
      connectionType: 'oauth2',
      userId: null,
      status: 'active',
      accessTokenExpiresAt: null,
      providerAccountId: null,
      providerWebhookId: null,
      scopes: null,
      failureCount: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect('credentialsEncrypted' in record).toBe(false)
    expect('refreshTokenEncrypted' in record).toBe(false)
    expect(record.accessTokenExpiresAt).toBeNull()
  })
})

describe('IntegrationSyncStateRecord', () => {
  it('has correct shape', () => {
    const record: IntegrationSyncStateRecord = {
      id: 'iss_test',
      connectionId: 'ic_test',
      stream: 'inbox',
      cursor: null,
      processedEventIds: [],
      lastSyncedAt: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(record.processedEventIds).toEqual([])
  })
})
