import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { createTenantPostgresRepository, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import { assertTenantPatchOrganizationInvariant } from '../../repositories/tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { contractRecordSchema, type ContractRecord } from './validators.js'

export interface ContractRepository {
  create(ctx: OrbitAuthContext, record: ContractRecord): Promise<ContractRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ContractRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<ContractRecord>): Promise<ContractRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ContractRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ContractRecord>>
}

export function createInMemoryContractRepository(seed: ContractRecord[] = []): ContractRepository {
  const rows = new Map(seed.map((record) => [record.id, contractRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): ContractRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  const queryOptions = {
    searchableFields: ['title', 'content', 'status', 'externalSignatureId'],
    filterableFields: [
      'id',
      'organization_id',
      'title',
      'status',
      'deal_id',
      'contact_id',
      'company_id',
      'external_signature_id',
      'signed_at',
      'expires_at',
    ],
    defaultSort: [{ field: 'updated_at', direction: 'desc' as const }],
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Contract organization mismatch')
      }

      const parsed = contractRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async update(ctx, id, patch) {
      const current = await this.get(ctx, id)

      if (!current) {
        return null
      }

      assertTenantPatchOrganizationInvariant(current.organizationId, patch)

      const next = contractRecordSchema.parse({
        ...current,
        ...patch,
      })
      rows.set(id, next)
      return next
    },
    async delete(ctx, id) {
      const current = await this.get(ctx, id)
      if (!current) {
        return false
      }

      rows.delete(id)
      return true
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, queryOptions)
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, queryOptions)
    },
  }
}

export function createSqliteContractRepository(adapter: StorageAdapter): ContractRepository {
  return createTenantSqliteRepository<ContractRecord>(adapter, {
    tableName: 'contracts',
    columns: [
      'id',
      'organization_id',
      'title',
      'content',
      'status',
      'signed_at',
      'expires_at',
      'deal_id',
      'contact_id',
      'company_id',
      'external_signature_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['title', 'content', 'status', 'external_signature_id'],
    filterableFields: [
      'id',
      'organization_id',
      'title',
      'status',
      'deal_id',
      'contact_id',
      'company_id',
      'external_signature_id',
      'signed_at',
      'expires_at',
    ],
    defaultSort: [{ field: 'updated_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        title: record.title,
        content: record.content ?? null,
        status: record.status,
        signed_at: toSqliteDate(record.signedAt),
        expires_at: toSqliteDate(record.expiresAt),
        deal_id: record.dealId ?? null,
        contact_id: record.contactId ?? null,
        company_id: record.companyId ?? null,
        external_signature_id: record.externalSignatureId ?? null,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return contractRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        title: row.title,
        content: row.content ?? null,
        status: row.status,
        signedAt: fromSqliteDate(row.signed_at),
        expiresAt: fromSqliteDate(row.expires_at),
        dealId: row.deal_id ?? null,
        contactId: row.contact_id ?? null,
        companyId: row.company_id ?? null,
        externalSignatureId: row.external_signature_id ?? null,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresContractRepository(adapter: StorageAdapter): ContractRepository {
  return createTenantPostgresRepository<ContractRecord>(adapter, {
    tableName: 'contracts',
    columns: [
      'id',
      'organization_id',
      'title',
      'content',
      'status',
      'signed_at',
      'expires_at',
      'deal_id',
      'contact_id',
      'company_id',
      'external_signature_id',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: ['title', 'content', 'status', 'external_signature_id'],
    filterableFields: [
      'id',
      'organization_id',
      'title',
      'status',
      'deal_id',
      'contact_id',
      'company_id',
      'external_signature_id',
      'signed_at',
      'expires_at',
    ],
    defaultSort: [{ field: 'updated_at', direction: 'desc' }],
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        title: record.title,
        content: record.content ?? null,
        status: record.status,
        signed_at: record.signedAt,
        expires_at: record.expiresAt,
        deal_id: record.dealId ?? null,
        contact_id: record.contactId ?? null,
        company_id: record.companyId ?? null,
        external_signature_id: record.externalSignatureId ?? null,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return contractRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        title: row.title,
        content: row.content ?? null,
        status: row.status,
        signedAt: fromPostgresDate(row.signed_at),
        expiresAt: fromPostgresDate(row.expires_at),
        dealId: row.deal_id ?? null,
        contactId: row.contact_id ?? null,
        companyId: row.company_id ?? null,
        externalSignatureId: row.external_signature_id ?? null,
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
