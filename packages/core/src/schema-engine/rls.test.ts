import { describe, expect, it } from 'vitest'

import {
  BOOTSTRAP_TABLES,
  IMPLEMENTED_TENANT_TABLES,
} from '../repositories/tenant-scope.js'
import { generatePostgresRlsSql } from './rls.js'

describe('generatePostgresRlsSql', () => {
  const statements = generatePostgresRlsSql()

  it('emits current_org_id() helper SQL as the first statement', () => {
    expect(statements[0]).toMatch(/create or replace function\b/)
    expect(statements[0]).toContain('current_org_id()')
    expect(statements[0]).toContain("current_setting('app.current_org_id', true)")
  })

  it('generates enable RLS + four policies for every IMPLEMENTED_TENANT_TABLE', () => {
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      const tableStatements = statements.filter((s) => s.includes(`.${table}`))

      // 1 enable RLS + 4 × (DROP + CREATE) = 9 statements per table
      expect(tableStatements.length, `expected 9 statements for ${table}`).toBe(9)

      expect(tableStatements).toContainEqual(
        expect.stringContaining(`alter table orbit.${table} enable row level security`),
      )

      for (const op of ['select', 'insert', 'update', 'delete'] as const) {
        expect(
          tableStatements.some((s) => s.includes(`create policy ${table}_${op}`)),
          `missing create policy ${table}_${op}`,
        ).toBe(true)
      }
    }
  })

  it('does NOT generate tenant RLS policies for bootstrap tables', () => {
    for (const table of BOOTSTRAP_TABLES) {
      const matching = statements.filter((s) => s.includes(`.${table} `))
      expect(matching, `bootstrap table "${table}" should have no RLS statements`).toHaveLength(0)
    }
  })

  it('emits DROP POLICY IF EXISTS before each CREATE POLICY (idempotency)', () => {
    for (let i = 0; i < statements.length; i++) {
      if (statements[i].startsWith('create policy ')) {
        const policyName = statements[i].split(' ')[2] // e.g. "users_select"
        expect(statements[i - 1]).toBe(
          `drop policy if exists ${policyName} on orbit.${policyName.replace(/_(select|insert|update|delete)$/, '')};`,
        )
      }
    }
  })

  it('produces no duplicate statements when called twice', () => {
    const first = generatePostgresRlsSql()
    const second = generatePostgresRlsSql()
    expect(first).toEqual(second)
    // Also verify no duplicates within a single call
    const unique = new Set(first)
    expect(unique.size).toBe(first.length)
  })

  it('covers exactly IMPLEMENTED_TENANT_TABLES — no more, no less (drift detection)', () => {
    const tablesInRls = new Set<string>()
    for (const stmt of statements) {
      const match = stmt.match(/alter table orbit\.(\w+) enable row level security/)
      if (match) tablesInRls.add(match[1])
    }

    const expectedTables = new Set<string>(IMPLEMENTED_TENANT_TABLES)

    expect(tablesInRls).toEqual(expectedTables)
  })

  it('respects custom schema name', () => {
    const custom = generatePostgresRlsSql('my_schema')
    expect(custom[0]).toContain('my_schema.current_org_id()')
    expect(custom.some((s) => s.includes('my_schema.users'))).toBe(true)
    expect(custom.every((s) => !s.includes('orbit.'))).toBe(true)
  })
})
