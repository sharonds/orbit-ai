import { describe, expect, it, vi } from 'vitest'

import type { OrbitDatabase, StorageAdapter } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import { createPostgresCustomFieldDefinitionRepository } from './repository.js'
import type { CustomFieldDefinitionRecord } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const

function makeRecord(overrides: Partial<CustomFieldDefinitionRecord> = {}): CustomFieldDefinitionRecord {
  return {
    id: generateId('customField'),
    organizationId: ctx.orgId,
    entityType: 'contacts',
    fieldName: 'priority',
    fieldType: 'text',
    label: 'Priority',
    description: null,
    isRequired: false,
    isIndexed: false,
    isPromoted: false,
    promotedColumnName: null,
    defaultValue: null,
    options: [],
    validation: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('custom field definition repository', () => {
  it('coerces plain Postgres 23505 objects into custom field conflicts', async () => {
    const db = {
      execute: vi.fn(async () => {
        throw { code: '23505' }
      }),
      query: vi.fn(async () => []),
      transaction: async <T>(fn: (tx: OrbitDatabase) => Promise<T>) => fn(db as OrbitDatabase),
    }
    const adapter = {
      withTenantContext: vi.fn(async (
        _ctx: unknown,
        fn: (database: OrbitDatabase) => Promise<unknown>,
      ) => fn(db as OrbitDatabase)),
    } as unknown as StorageAdapter
    const repository = createPostgresCustomFieldDefinitionRepository(adapter)

    await expect(repository.create(ctx, makeRecord())).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'fieldName',
    })
  })
})
