import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'

import { createSqliteStorageAdapter } from '../../adapters/sqlite/adapter.js'
import { createSqliteOrbitDatabase } from '../../adapters/sqlite/database.js'
import { createSqliteOrganizationMembershipRepository } from './repository.js'

const ctxA = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

describe('organization membership sqlite repository', () => {
  it('requires trusted org context on create and scopes reads', async () => {
    const database = createSqliteOrbitDatabase()
    await database.execute(sql.raw(`
      create table if not exists organization_memberships (
        id text primary key,
        organization_id text not null,
        user_id text not null,
        role text not null,
        invited_by_user_id text,
        joined_at text,
        created_at text not null,
        updated_at text not null
      )
    `))

    const adapter = createSqliteStorageAdapter({ database })
    const repository = createSqliteOrganizationMembershipRepository(adapter)
    const record = {
      id: 'mbr_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctxA.orgId,
      userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      role: 'owner',
      invitedByUserId: null,
      joinedAt: null,
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    }

    await expect(
      repository.create(
        ctxB,
        record,
      ),
    ).rejects.toThrow('Organization membership organization mismatch')

    await expect(repository.create(ctxA, record)).resolves.toEqual(record)
    await expect(repository.get(ctxA, record.id)).resolves.toEqual(record)
    await expect(repository.get(ctxB, record.id)).resolves.toBeNull()
    await expect(repository.list(ctxB, { limit: 10 })).resolves.toMatchObject({ data: [] })
  })
})
