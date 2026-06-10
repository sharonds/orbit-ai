import { describe, expect, it } from 'vitest'
import {
  SCHEMA_MIGRATION_INTERNAL_FIELD_NAMES,
  isSchemaMigrationInternalField,
  stripSchemaMigrationInternalFields,
} from './redaction.js'

describe('schema migration redaction denylist', () => {
  it('contains exactly the four internal SQL field names', () => {
    expect([...SCHEMA_MIGRATION_INTERNAL_FIELD_NAMES].sort()).toEqual([
      'rollbackStatements',
      'rollback_statements',
      'sqlStatements',
      'sql_statements',
    ])
  })

  it.each([
    ['sqlStatements'],
    ['rollbackStatements'],
    ['sql_statements'],
    ['rollback_statements'],
  ])('isSchemaMigrationInternalField returns true for %s', (key) => {
    expect(isSchemaMigrationInternalField(key)).toBe(true)
  })

  it.each([
    ['checksum'],
    ['status'],
    ['operations'],
    ['migrationId'],
    ['sqlstatements'], // exact match only — no case folding
    ['sql'],
  ])('isSchemaMigrationInternalField returns false for %s', (key) => {
    expect(isSchemaMigrationInternalField(key)).toBe(false)
  })

  it('stripSchemaMigrationInternalFields removes all four names and keeps the rest', () => {
    const stripped = stripSchemaMigrationInternalFields({
      checksum: 'a'.repeat(64),
      status: 'applied',
      sqlStatements: ['alter table contacts add column secret text'],
      rollbackStatements: ['alter table contacts drop column secret'],
      sql_statements: ['legacy snake case'],
      rollback_statements: ['legacy snake case rollback'],
    })

    expect(stripped).toEqual({
      checksum: 'a'.repeat(64),
      status: 'applied',
    })
  })

  it('stripSchemaMigrationInternalFields returns an unchanged copy when nothing matches', () => {
    const input = { checksum: 'abc', destructive: false }
    const stripped = stripSchemaMigrationInternalFields(input)
    expect(stripped).toEqual(input)
    expect(stripped).not.toBe(input)
  })
})
