import { describe, expect, it } from 'vitest'

import {
  computeSchemaMigrationChecksum,
  schemaMigrationApplyInputSchema,
  schemaMigrationChecksumSchema,
  schemaMigrationPreviewOutputSchema,
  schemaMigrationPreviewInputSchema,
  schemaMigrationUpdateFieldInputSchema,
  schemaMigrationUpdateFieldRequestInputSchema,
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
    for (const key of ['orgId', 'organizationId', 'organization_id', 'actorId', 'appliedBy', 'applied_by_user_id']) {
      expect(schemaMigrationPreviewInputSchema.safeParse({
        [key]: 'caller-controlled',
        operations: [addFieldOperation],
      }).success).toBe(false)

      expect(schemaMigrationApplyInputSchema.safeParse({
        [key]: 'caller-controlled',
        checksum: '0'.repeat(64),
        operations: [addFieldOperation],
      }).success).toBe(false)
    }

    for (const key of ['orgId', 'organizationId', 'organization_id', 'actorId', 'appliedBy', 'applied_by_user_id']) {
      expect(schemaMigrationPreviewInputSchema.safeParse({
        operations: [{
          ...addFieldOperation,
          [key]: 'caller-controlled',
        }],
      }).success).toBe(false)
    }
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

  it('canonicalizes checksum keys without locale-sensitive sorting', () => {
    const originalLocaleCompare = String.prototype.localeCompare
    String.prototype.localeCompare = () => {
      throw new Error('localeCompare must not be used for checksum canonicalization')
    }

    try {
      expect(computeSchemaMigrationChecksum({
        adapter: { name: 'sqlite', dialect: 'sqlite' },
        orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        operations: [{
          ...addFieldOperation,
          defaultValue: { b: 1, a: 2 },
        }],
      })).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      String.prototype.localeCompare = originalLocaleCompare
    }
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

  it('rejects operation-level confirmations in public migration operations', () => {
    for (const operation of [
      { type: 'custom_field.delete', entityType: 'contacts', fieldName: 'legacy_code' },
      { type: 'custom_field.rename', entityType: 'contacts', fieldName: 'legacy_code', newFieldName: 'legacy_code_new' },
      { type: 'column.drop', tableName: 'contacts', columnName: 'legacy_code' },
      { type: 'column.rename', tableName: 'contacts', columnName: 'legacy_code', newColumnName: 'legacy_code_new' },
    ]) {
      expect(schemaMigrationPreviewInputSchema.safeParse({
        operations: [{
          ...operation,
          confirmation: {
            destructive: true,
            checksum: '0'.repeat(64),
            confirmedAt: '2026-04-26T00:00:00.000Z',
          },
        }],
      }).success).toBe(false)
    }
  })

  it('rejects empty custom field update patches', () => {
    expect(schemaMigrationUpdateFieldInputSchema.safeParse({}).success).toBe(false)
    expect(schemaMigrationUpdateFieldRequestInputSchema.safeParse({
      confirmation: {
        destructive: true,
        checksum: '0'.repeat(64),
        confirmedAt: new Date().toISOString(),
      },
    }).success).toBe(false)
  })

  it('requires preview output plan metadata', () => {
    const checksum = '0'.repeat(64)

    expect(schemaMigrationPreviewOutputSchema.safeParse({
      checksum,
      operations: [addFieldOperation],
      destructive: false,
      confirmationRequired: false,
      warnings: [],
    }).success).toBe(false)

    expect(schemaMigrationPreviewOutputSchema.safeParse({
      checksum,
      operations: [addFieldOperation],
      destructive: false,
      confirmationRequired: false,
      warnings: [],
      summary: 'Add linkedin_url custom field to contacts',
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      scope: { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' },
      confirmationInstructions: {
        required: false,
        instructions: 'No destructive confirmation is required.',
        destructiveOperations: [],
      },
    }).success).toBe(true)
  })

  it('rejects non-canonical semantic values before checksum computation', () => {
    for (const badValue of [
      () => 'nope',
      Symbol('nope'),
      1n,
      Number.NaN,
      [undefined],
      { nested: undefined },
    ]) {
      expect(schemaMigrationPreviewInputSchema.safeParse({
        operations: [{
          ...addFieldOperation,
          defaultValue: badValue,
        }],
      }).success).toBe(false)
    }
  })

  it('rejects raw SQL/DDL/script-shaped values inside semantic payload fields', () => {
    for (const badValue of [
      { sql: 'alter table contacts add column tier text' },
      { ddl: 'create table leaked (id text)' },
      { script: '<script>alert(1)</script>' },
      { statements: ['drop table contacts'] },
      'alter table contacts add column tier text',
      'create extension pgcrypto',
      'drop database orbit',
      'grant all on schema public to public',
      'delete from contacts',
      'insert into contacts values (1)',
      'pragma table_info(contacts)',
      '<script>alert(1)</script>',
    ]) {
      expect(schemaMigrationPreviewInputSchema.safeParse({
        operations: [{
          ...addFieldOperation,
          defaultValue: badValue,
        }],
      }).success).toBe(false)
    }
  })

  it('allows ordinary semantic strings in public payload values', () => {
    expect(schemaMigrationPreviewInputSchema.safeParse({
      operations: [{
        ...addFieldOperation,
        defaultValue: 'Enterprise plan',
      }],
    }).success).toBe(true)
  })
})
