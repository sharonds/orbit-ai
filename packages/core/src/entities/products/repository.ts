import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { createTenantPostgresRepository, fromPostgresBoolean, fromPostgresDate, fromPostgresJson } from '../../repositories/postgres/shared.js'
import {
  createTenantSqliteRepository,
  fromSqliteBoolean,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteBoolean,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { productRecordSchema, type ProductRecord } from './validators.js'

export interface ProductRepository {
  create(ctx: OrbitAuthContext, record: ProductRecord): Promise<ProductRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ProductRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<ProductRecord>): Promise<ProductRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ProductRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ProductRecord>>
}

const PRODUCT_SEARCHABLE_FIELDS = ['name', 'description', 'currency']
const PRODUCT_FILTERABLE_FIELDS = ['id', 'organization_id', 'name', 'currency', 'is_active', 'sort_order']
const PRODUCT_DEFAULT_SORT = [
  { field: 'sort_order', direction: 'asc' as const },
  { field: 'created_at', direction: 'desc' as const },
]

export function createInMemoryProductRepository(seed: ProductRecord[] = []): ProductRepository {
  const rows = new Map(seed.map((record) => [record.id, productRecordSchema.parse(record)]))

  function scopedRows(ctx: OrbitAuthContext): ProductRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((record) => record.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Product organization mismatch')
      }

      const parsed = productRecordSchema.parse(record)
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

      const next = productRecordSchema.parse({
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
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: PRODUCT_SEARCHABLE_FIELDS,
        filterableFields: PRODUCT_FILTERABLE_FIELDS,
        defaultSort: PRODUCT_DEFAULT_SORT,
      })
    },
    async search(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: PRODUCT_SEARCHABLE_FIELDS,
        filterableFields: PRODUCT_FILTERABLE_FIELDS,
        defaultSort: PRODUCT_DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteProductRepository(adapter: StorageAdapter): ProductRepository {
  return createTenantSqliteRepository<ProductRecord>(adapter, {
    tableName: 'products',
    columns: [
      'id',
      'organization_id',
      'name',
      'price',
      'currency',
      'description',
      'is_active',
      'sort_order',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: PRODUCT_SEARCHABLE_FIELDS,
    filterableFields: PRODUCT_FILTERABLE_FIELDS,
    defaultSort: PRODUCT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        price: record.price,
        currency: record.currency,
        description: record.description ?? null,
        is_active: toSqliteBoolean(record.isActive),
        sort_order: record.sortOrder,
        custom_fields: toSqliteJson(record.customFields),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return productRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        price: row.price,
        currency: row.currency,
        description: row.description ?? null,
        isActive: fromSqliteBoolean(row.is_active),
        sortOrder: row.sort_order,
        customFields: fromSqliteJson(row.custom_fields, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })
}

export function createPostgresProductRepository(adapter: StorageAdapter): ProductRepository {
  return createTenantPostgresRepository<ProductRecord>(adapter, {
    tableName: 'products',
    columns: [
      'id',
      'organization_id',
      'name',
      'price',
      'currency',
      'description',
      'is_active',
      'sort_order',
      'custom_fields',
      'created_at',
      'updated_at',
    ],
    searchableFields: PRODUCT_SEARCHABLE_FIELDS,
    filterableFields: PRODUCT_FILTERABLE_FIELDS,
    defaultSort: PRODUCT_DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        name: record.name,
        price: record.price,
        currency: record.currency,
        description: record.description ?? null,
        is_active: record.isActive,
        sort_order: record.sortOrder,
        custom_fields: record.customFields,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return productRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        price: row.price,
        currency: row.currency,
        description: row.description ?? null,
        isActive: fromPostgresBoolean(row.is_active),
        sortOrder: row.sort_order,
        customFields: fromPostgresJson(row.custom_fields, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })
}
