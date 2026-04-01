import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { assertOrgContext } from '../../services/service-helpers.js'
import { fromSqliteDate } from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresDate,
} from '../../repositories/postgres/shared.js'
import { runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { organizationMembershipRecordSchema, type OrganizationMembershipRecord } from './validators.js'

export interface OrganizationMembershipRepository {
  create(ctx: OrbitAuthContext, record: OrganizationMembershipRecord): Promise<OrganizationMembershipRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<OrganizationMembershipRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<OrganizationMembershipRecord>>
}

export function createInMemoryOrganizationMembershipRepository(
  seed: OrganizationMembershipRecord[] = [],
): OrganizationMembershipRepository {
  const rows = new Map(seed.map((record) => [record.id, organizationMembershipRecordSchema.parse(record)]))

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Organization membership organization mismatch')
      }

      const parsed = organizationMembershipRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const record = rows.get(id)
      return record && record.organizationId === ctx.orgId ? record : null
    },
    async list(ctx, query) {
      return runArrayQuery(
        [...rows.values()].filter((record) => record.organizationId === ctx.orgId),
        query,
        {
          searchableFields: ['role'],
          filterableFields: ['id', 'organization_id', 'user_id', 'role', 'invited_by_user_id', 'joined_at'],
          defaultSort: [{ field: 'created_at', direction: 'desc' }],
        },
      )
    },
  }
}

export function createSqliteOrganizationMembershipRepository(
  adapter: StorageAdapter,
): OrganizationMembershipRepository {
  const tableName = 'organization_memberships'

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Organization membership organization mismatch')
      }

      await adapter.withTenantContext(ctx, async (db) => {
        await db.execute(
          sql`insert into ${sql.raw(tableName)} (
            id,
            organization_id,
            user_id,
            role,
            invited_by_user_id,
            joined_at,
            created_at,
            updated_at
          ) values (
            ${record.id},
            ${record.organizationId},
            ${record.userId},
            ${record.role},
            ${record.invitedByUserId ?? null},
            ${record.joinedAt ? record.joinedAt.toISOString() : null},
            ${record.createdAt.toISOString()},
            ${record.updatedAt.toISOString()}
          )`,
        )
      })

      return record
    },
    async get(ctx, id) {
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(
          sql`select * from ${sql.raw(tableName)} where id = ${id} and organization_id = ${ctx.orgId} limit 1`,
        )
        return rows[0]
          ? organizationMembershipRecordSchema.parse({
              id: rows[0].id,
              organizationId: rows[0].organization_id,
              userId: rows[0].user_id,
              role: rows[0].role,
              invitedByUserId: rows[0].invited_by_user_id ?? null,
              joinedAt: fromSqliteDate(rows[0].joined_at),
              createdAt: fromSqliteDate(rows[0].created_at),
              updatedAt: fromSqliteDate(rows[0].updated_at),
            })
          : null
      })
    },
    async list(ctx, query) {
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(
          sql`select * from ${sql.raw(tableName)} where organization_id = ${ctx.orgId}`,
        )
        return runArrayQuery(
          rows.map((row) =>
            organizationMembershipRecordSchema.parse({
              id: row.id,
              organizationId: row.organization_id,
              userId: row.user_id,
              role: row.role,
              invitedByUserId: row.invited_by_user_id ?? null,
              joinedAt: fromSqliteDate(row.joined_at),
              createdAt: fromSqliteDate(row.created_at),
              updatedAt: fromSqliteDate(row.updated_at),
            }),
          ),
          query,
          {
            searchableFields: ['role'],
            filterableFields: ['id', 'organization_id', 'user_id', 'role', 'invited_by_user_id', 'joined_at'],
            defaultSort: [{ field: 'created_at', direction: 'desc' }],
          },
        )
      })
    },
  }
}

export function createPostgresOrganizationMembershipRepository(
  adapter: StorageAdapter,
): OrganizationMembershipRepository {
  return createTenantPostgresRepository<OrganizationMembershipRecord>(adapter, {
    tableName: 'organization_memberships',
    columns: [
      'id',
      'organization_id',
      'user_id',
      'role',
      'invited_by_user_id',
      'joined_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['role'],
    filterableFields: ['id', 'organization_id', 'user_id', 'role', 'invited_by_user_id', 'joined_at'],
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        user_id: record.userId,
        role: record.role,
        invited_by_user_id: record.invitedByUserId ?? null,
        joined_at: record.joinedAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return organizationMembershipRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        role: row.role,
        invitedByUserId: row.invited_by_user_id ?? null,
        joinedAt: fromPostgresDate(row.joined_at),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
