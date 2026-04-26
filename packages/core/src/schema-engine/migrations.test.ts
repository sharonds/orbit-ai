import { describe, expect, it } from 'vitest'

import {
  computeSchemaMigrationChecksum,
  schemaMigrationApplyInputSchema,
  schemaMigrationChecksumSchema,
  schemaMigrationPreviewInputSchema,
} from './migrations.js'

const addFieldOperation = {
  type: 'custom_field.add',
  entityType: 'contacts',
  fieldName: 'linkedin_url',
  fieldType: 'url',
  label: 'LinkedIn URL',
}

describe('schema migration domain contracts', () => {
  it('rejects unknown migration operation types', () => {
    const result = schemaMigrationPreviewInputSchema.safeParse({
      operations: [{ type: 'raw_sql', statement: 'alter table contacts add column tier text' }],
    })

    expect(result.success).toBe(false)
  })

  it('rejects caller-controlled org and actor fields in public inputs', () => {
    expect(schemaMigrationPreviewInputSchema.safeParse({
      orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      operations: [addFieldOperation],
    }).success).toBe(false)

    expect(schemaMigrationPreviewInputSchema.safeParse({
      operations: [{
        ...addFieldOperation,
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }],
    }).success).toBe(false)

    expect(schemaMigrationApplyInputSchema.safeParse({
      actorId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      checksum: '0'.repeat(64),
      operations: [addFieldOperation],
    }).success).toBe(false)
  })

  it('computes stable checksums from adapter, trusted org scope, and forward operations', () => {
    const checksum = computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      operations: [addFieldOperation],
    })

    expect(schemaMigrationChecksumSchema.safeParse(checksum).success).toBe(true)
    expect(computeSchemaMigrationChecksum({
      adapter: { dialect: 'sqlite', name: 'sqlite' },
      orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      operations: [addFieldOperation],
    })).toBe(checksum)

    expect(computeSchemaMigrationChecksum({
      adapter: { name: 'postgres', dialect: 'postgres' },
      orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      operations: [addFieldOperation],
    })).not.toBe(checksum)

    expect(computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      operations: [addFieldOperation],
    })).not.toBe(checksum)

    expect(computeSchemaMigrationChecksum({
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      operations: [{ ...addFieldOperation, label: 'LinkedIn' }],
    })).not.toBe(checksum)
  })

  it.each(['sql', 'ddl', 'script', 'statements'])(
    'rejects public raw %s payloads on semantic operations',
    (rawKey) => {
      const result = schemaMigrationPreviewInputSchema.safeParse({
        operations: [{
          ...addFieldOperation,
          [rawKey]: 'alter table contacts add column tier text',
        }],
      })

      expect(result.success).toBe(false)
    },
  )
})
