import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ADAPTER_AUTHORITY_MODEL,
  asMigrationDatabase,
  type ApiKeyAuthLookup,
  type OrbitDatabase,
  type StorageAdapter,
} from './interface.js'

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
      scopes: ['contacts:read'],
      revokedAt: null,
      expiresAt: null,
    }

    expect(Object.keys(lookup).sort()).toEqual([
      'expiresAt',
      'id',
      'organizationId',
      'revokedAt',
      'scopes',
    ])
  })

  it('keeps lookupApiKeyForAuth keyed on the hash and returns only the auth DTO', async () => {
    const expectedHash = 'hashed_api_key_value'
    const adapter: Pick<StorageAdapter, 'lookupApiKeyForAuth'> = {
      async lookupApiKeyForAuth(keyHash) {
        expect(keyHash).toBe(expectedHash)

        return {
          id: 'key_01ABCDEF0123456789ABCDEF01',
          organizationId: 'org_01ABCDEF0123456789ABCDEF01',
          scopes: ['contacts:read'],
          revokedAt: null,
          expiresAt: null,
        }
      },
    }

    await expect(adapter.lookupApiKeyForAuth(expectedHash)).resolves.toEqual({
      id: 'key_01ABCDEF0123456789ABCDEF01',
      organizationId: 'org_01ABCDEF0123456789ABCDEF01',
      scopes: ['contacts:read'],
      revokedAt: null,
      expiresAt: null,
    })
  })

  it('keeps getSchemaSnapshot aligned with the custom field definition contract', async () => {
    const adapter: Pick<StorageAdapter, 'getSchemaSnapshot'> = {
      async getSchemaSnapshot() {
        return {
          customFields: [
            {
              id: 'field_01ABCDEF0123456789ABCDEF01',
              organizationId: 'org_01ABCDEF0123456789ABCDEF01',
              entityType: 'contacts',
              fieldName: 'wedding_date',
              fieldType: 'date',
              label: 'Wedding Date',
              description: 'Optional custom date field',
              isRequired: false,
              isIndexed: false,
              isPromoted: false,
              promotedColumnName: undefined,
              defaultValue: undefined,
              options: [],
              validation: {},
            },
          ],
          tables: ['organizations', 'users', 'organization_memberships', 'api_keys'],
        }
      },
    }

    await expect(adapter.getSchemaSnapshot()).resolves.toEqual({
      customFields: [
        {
          id: 'field_01ABCDEF0123456789ABCDEF01',
          organizationId: 'org_01ABCDEF0123456789ABCDEF01',
          entityType: 'contacts',
          fieldName: 'wedding_date',
          fieldType: 'date',
          label: 'Wedding Date',
          description: 'Optional custom date field',
          isRequired: false,
          isIndexed: false,
          isPromoted: false,
          promotedColumnName: undefined,
          defaultValue: undefined,
          options: [],
          validation: {},
        },
      ],
      tables: ['organizations', 'users', 'organization_memberships', 'api_keys'],
    })
  })

  it('brands migration authority separately from the runtime database handle', async () => {
    const runtimeDb = {
      transaction: async (fn: (tx: OrbitDatabase) => Promise<string>) => fn(runtimeDb),
      execute: async () => undefined,
      query: async () => [],
    } satisfies OrbitDatabase
    const migrationDb = asMigrationDatabase(runtimeDb)

    const adapter: Pick<StorageAdapter, 'runWithMigrationAuthority' | 'unsafeRawDatabase'> = {
      unsafeRawDatabase: runtimeDb,
      async runWithMigrationAuthority(fn) {
        return fn(migrationDb)
      },
    }

    const result = await adapter.runWithMigrationAuthority(async (db) => {
      expect(db).toBe(migrationDb)
      expect(db).toBe(adapter.unsafeRawDatabase)
      return 'ok'
    })

    expect(result).toBe('ok')
  })
})
