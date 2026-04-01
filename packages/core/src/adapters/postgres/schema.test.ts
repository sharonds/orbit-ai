import type { SQL } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { initializePostgresWave1Schema } from './schema.js'

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
