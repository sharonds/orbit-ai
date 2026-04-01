import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'

import { createSqliteStorageAdapter } from '../../adapters/sqlite/adapter.js'
import { createSqliteOrbitDatabase } from '../../adapters/sqlite/database.js'
import { assertOrgContext } from '../../services/service-helpers.js'
import { createTenantSqliteRepository, fromSqliteJson } from './shared.js'

const ctxA = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

interface WidgetRecord {
  id: string
  organizationId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

describe('sqlite shared repository helpers', () => {
  it('falls back safely when sqlite json is malformed', () => {
    expect(fromSqliteJson('{"ok":true', { ok: false })).toEqual({ ok: false })
    expect(fromSqliteJson(undefined, ['fallback'])).toEqual(['fallback'])
  })

  it('keeps tenant-scoped create/read/update/delete operations org-bound', async () => {
    const database = createSqliteOrbitDatabase()
    await database.execute(sql.raw(`
      create table if not exists widgets (
        id text primary key,
        organization_id text not null,
        name text not null,
        created_at text not null,
        updated_at text not null
      )
    `))

    const adapter = createSqliteStorageAdapter({ database })
    const repository = createTenantSqliteRepository<WidgetRecord>(adapter, {
      tableName: 'widgets',
      columns: ['id', 'organization_id', 'name', 'created_at', 'updated_at'],
      searchableFields: ['name'],
      defaultSort: [{ field: 'created_at', direction: 'desc' }],
      serialize(record) {
        return {
          id: record.id,
          organization_id: record.organizationId,
          name: record.name,
          created_at: record.createdAt.toISOString(),
          updated_at: record.updatedAt.toISOString(),
        }
      },
      deserialize(row) {
        return {
          id: String(row.id),
          organizationId: String(row.organization_id),
          name: String(row.name),
          createdAt: new Date(String(row.created_at)),
          updatedAt: new Date(String(row.updated_at)),
        }
      },
    })

    const created = await repository.create(ctxA, {
      id: 'wgt_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: assertOrgContext(ctxA),
      name: 'Alpha',
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: new Date('2026-04-01T09:00:00.000Z'),
    })

    expect(await repository.get(ctxA, created.id)).toEqual(created)
    expect(await repository.get(ctxB, created.id)).toBeNull()
    expect(await repository.update(ctxB, created.id, { name: 'Beta' })).toBeNull()
    expect(await repository.delete(ctxB, created.id)).toBe(false)

    await expect(
      repository.create(ctxB, {
        ...created,
        id: 'wgt_01ARYZ6S41XXXXXXXXXXXXXXXXXX',
        organizationId: assertOrgContext(ctxA),
      }),
    ).rejects.toThrow('Tenant record organization mismatch')

    const updated = await repository.update(ctxA, created.id, { name: 'Gamma' })
    expect(updated?.name).toBe('Gamma')
    expect(await repository.delete(ctxA, created.id)).toBe(true)
    expect(await repository.get(ctxA, created.id)).toBeNull()
  })
})
