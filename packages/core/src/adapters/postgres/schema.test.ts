import type { SQL } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { initializePostgresWave1Schema, applyPostgresRlsDdl } from './schema.js'

function render(statement: SQL) {
  return statement.toQuery({
    escapeName: (value) => value,
    escapeParam: () => '?',
    escapeString: (value) => JSON.stringify(value),
    casing: { getColumnCasing: (column) => column },
    inlineParams: false,
    paramStartIndex: { value: 0 },
  })
}

describe('initializePostgresWave1Schema', () => {
  it('emits the expected wave 1 bootstrap statements', async () => {
    const statements: string[] = []
    const db = {
      async execute(statement: SQL) {
        statements.push(render(statement).sql)
      },
    }

    await initializePostgresWave1Schema(db as never)

    expect(statements).toHaveLength(26)
    expect(statements[0]).toContain('create table if not exists organizations')
    expect(statements[1]).toContain('create table if not exists users')
    expect(statements[6]).toContain('create table if not exists api_keys')
    expect(statements.at(-1)).toContain('create index if not exists deals_company_idx')
  })
})

describe('applyPostgresRlsDdl', () => {
  it('emits the expected RLS bootstrap statements', async () => {
    const statements: string[] = []
    const db = {
      async execute(statement: SQL) {
        statements.push(render(statement).sql)
      },
    }

    await applyPostgresRlsDdl(db as never)

    // 1 helper function + 27 tenant tables × 9 statements each = 244
    expect(statements).toHaveLength(244)

    // Helper function
    expect(statements[0]).toContain('create or replace function')
    expect(statements[0]).toContain('current_org_id')

    // First tenant table (users): enable RLS + 4 ops × (drop + create) = 9 statements
    expect(statements[1]).toContain('alter table')
    expect(statements[1]).toContain('enable row level security')

    // Verify select policy pair (drop + create)
    expect(statements[2]).toContain('drop policy if exists')
    expect(statements[3]).toContain('create policy')
    expect(statements[3]).toContain('for select')

    // Verify insert policy pair
    expect(statements[4]).toContain('drop policy if exists')
    expect(statements[5]).toContain('create policy')
    expect(statements[5]).toContain('for insert')

    // Verify update policy pair
    expect(statements[6]).toContain('drop policy if exists')
    expect(statements[7]).toContain('create policy')
    expect(statements[7]).toContain('for update')

    // Verify delete policy pair
    expect(statements[8]).toContain('drop policy if exists')
    expect(statements[9]).toContain('create policy')
    expect(statements[9]).toContain('for delete')

    // Verify last statement is for the last tenant table (idempotency_keys)
    expect(statements.at(-1)).toContain('idempotency_keys')
    expect(statements.at(-1)).toContain('for delete')
  })
})
