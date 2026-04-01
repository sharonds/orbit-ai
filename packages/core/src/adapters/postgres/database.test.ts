import { sql } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { createPostgresOrbitDatabase } from './database.js'
import { withTenantContext } from './tenant-context.js'

describe('PostgresOrbitDatabase', () => {
  it('keeps tenant context transaction-local across pooled reuse', async () => {
    const state = { currentOrgId: null as string | null }
    const queries: Array<{ text: string; values: unknown[] }> = []
    const client = {
      async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: unknown[] = []) {
        queries.push({ text, values })

        if (text === 'begin' || text === 'commit' || text === 'rollback') {
          if (text === 'commit' || text === 'rollback') {
            state.currentOrgId = null
          }
          return { rows: [], rowCount: 0 } as const
        }

        if (text.startsWith('savepoint ') || text.startsWith('release savepoint ') || text.startsWith('rollback to savepoint ')) {
          return { rows: [], rowCount: 0 } as const
        }

        if (text.includes("set_config('app.current_org_id'")) {
          state.currentOrgId = String(values[0] ?? null)
          return { rows: [{ set_config: state.currentOrgId }], rowCount: 1 } as const
        }

        if (text.includes("current_setting('app.current_org_id'")) {
          return { rows: [{ current_org_id: state.currentOrgId }], rowCount: 1 } as const
        }

        return { rows: [], rowCount: 0 } as const
      },
      release: vi.fn(),
    }
    const pool = {
      connect: vi.fn(async () => client),
      query: async <T extends Record<string, unknown>>(_text: string, _values?: unknown[]) => {
        return client.query<T>(_text, _values)
      },
    }
    const db = createPostgresOrbitDatabase({ pool })

    const first = await withTenantContext(db, { orgId: 'org_01ABCDEF0123456789ABCDEF01' }, async (tx) => {
      const rows = await tx.query<{ current_org_id: string | null }>(
        sql`select current_setting('app.current_org_id', true) as current_org_id`,
      )
      return rows[0]?.current_org_id ?? null
    })

    const outside = await db.query<{ current_org_id: string | null }>(
      sql`select current_setting('app.current_org_id', true) as current_org_id`,
    )

    const second = await withTenantContext(db, { orgId: 'org_01ABCDEF0123456789ABCDEF02' }, async (tx) => {
      const rows = await tx.query<{ current_org_id: string | null }>(
        sql`select current_setting('app.current_org_id', true) as current_org_id`,
      )
      return rows[0]?.current_org_id ?? null
    })

    expect(first).toBe('org_01ABCDEF0123456789ABCDEF01')
    expect(outside[0]?.current_org_id ?? null).toBeNull()
    expect(second).toBe('org_01ABCDEF0123456789ABCDEF02')
    expect(pool.connect).toHaveBeenCalledTimes(2)
    expect(client.release).toHaveBeenCalledTimes(2)
    expect(queries.some((entry) => entry.text === 'begin')).toBe(true)
    expect(queries.some((entry) => entry.text === 'commit')).toBe(true)
  })
})
