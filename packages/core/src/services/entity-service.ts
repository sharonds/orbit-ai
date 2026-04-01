import type { SearchQuery } from '../types/api.js'
import type { OrbitErrorShape } from '../types/errors.js'
import type { InternalPaginatedResult } from '../types/pagination.js'
import type { OrbitAuthContext } from '../adapters/interface.js'

export interface EntityService<TCreate, TUpdate, TRecord> {
  create(ctx: OrbitAuthContext, input: TCreate): Promise<TRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<TRecord | null>
  update(ctx: OrbitAuthContext, id: string, input: TUpdate): Promise<TRecord>
  delete(ctx: OrbitAuthContext, id: string): Promise<void>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TRecord>>
}

export interface BatchCapableEntityService<TCreate, TUpdate, TRecord> extends EntityService<TCreate, TUpdate, TRecord> {
  batch(
    ctx: OrbitAuthContext,
    operations: Array<
      | { action: 'create'; data: TCreate }
      | { action: 'update'; id: string; data: TUpdate }
      | { action: 'delete'; id: string }
    >,
  ): Promise<Array<{ ok: true; result: TRecord | { id: string; deleted: true } } | { ok: false; error: OrbitErrorShape }>>
}

export interface AdminEntityService<TRecord> {
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TRecord>>
  get(ctx: OrbitAuthContext, id: string): Promise<TRecord | null>
}
