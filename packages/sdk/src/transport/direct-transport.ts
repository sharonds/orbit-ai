import { createCoreServices, type OrbitEnvelope, type OrbitAuthContext } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'
import type { OrbitTransport, TransportRequest } from './index.js'
import { OrbitApiError } from '../errors.js'

export class DirectTransport implements OrbitTransport {
  private readonly services: ReturnType<typeof createCoreServices>
  private readonly ctx: OrbitAuthContext

  constructor(private readonly options: OrbitClientOptions) {
    if (!options.adapter || !options.context?.orgId) {
      throw new Error('Direct transport requires adapter and context.orgId')
    }
    this.services = createCoreServices(options.adapter)
    const ctx: OrbitAuthContext = {
      orgId: options.context.orgId,
      scopes: ['*'],
    }
    if (options.context.userId !== undefined) {
      ctx.userId = options.context.userId
    }
    this.ctx = ctx
  }

  async rawRequest<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    return this.request(input)
  }

  async request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    try {
      // Defense-in-depth: wrap in withTenantContext even though core repositories
      // also call it internally. This ensures RLS session variables are set before
      // any service code runs, protecting against future repository changes.
      const result = await this.options.adapter!.withTenantContext(this.ctx, async () => {
        return this.dispatch(input)
      })
      return this.wrapEnvelope(input.path, result) as OrbitEnvelope<T>
    } catch (err: unknown) {
      if (err instanceof OrbitApiError) throw err
      const orbitErr = err as { code?: string; message?: string; field?: string; retryable?: boolean }
      if (orbitErr.code) {
        throw new OrbitApiError(
          {
            code: orbitErr.code as OrbitApiError['error']['code'],
            message: orbitErr.message ?? 'Unknown error',
            field: orbitErr.field,
            retryable: orbitErr.retryable,
          },
          this.errorCodeToStatus(orbitErr.code),
        )
      }
      throw err
    }
  }

  private async dispatch(input: TransportRequest): Promise<unknown> {
    const { method, path, body, query } = input
    const segments = path.split('/').filter(Boolean)

    // Support both /v1/contacts and /contacts paths
    const startIdx = segments[0] === 'v1' ? 1 : 0
    const entity = segments[startIdx]
    const action = segments[startIdx + 1]

    if (!entity) throw new Error(`Unknown path: ${path}`)

    // Special routes
    if (method === 'POST' && entity === 'search') {
      return this.services.search.search(this.ctx, body as Parameters<typeof this.services.search.search>[1])
    }
    if (method === 'GET' && entity === 'context' && action) {
      return this.services.contactContext.getContactContext(this.ctx, { contactId: action })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = (this.services as any)[entity] as
      | { list?: Function; create?: Function; get?: Function; update?: Function; delete?: Function; search?: Function; batch?: Function }
      | undefined
    if (!service) throw new Error(`Unknown entity: ${entity}`)

    if (method === 'GET' && !action && service.list) return service.list(this.ctx, query ?? {})
    if (method === 'POST' && !action && service.create) return service.create(this.ctx, body)
    if (method === 'GET' && action && action !== 'search' && service.get) {
      const result = await service.get(this.ctx, action)
      if (result === null || result === undefined) {
        throw new OrbitApiError(
          { code: 'RESOURCE_NOT_FOUND', message: `${entity} ${action} not found` },
          404,
        )
      }
      return result
    }
    if (method === 'PATCH' && action && service.update) return service.update(this.ctx, action, body)
    if (method === 'DELETE' && action && service.delete) {
      await service.delete(this.ctx, action)
      return { id: action, deleted: true }
    }
    if (method === 'POST' && action === 'search' && service.search) return service.search(this.ctx, body)
    if (method === 'POST' && action === 'batch' && typeof service.batch === 'function') return service.batch(this.ctx, body)

    throw new Error(`Unhandled dispatch: ${method} ${path}`)
  }

  private wrapEnvelope(path: string, data: unknown): OrbitEnvelope<unknown> {
    const paginated = data as { data?: unknown[]; nextCursor?: string | null; hasMore?: boolean }
    if (
      paginated &&
      typeof paginated === 'object' &&
      'data' in paginated &&
      'hasMore' in paginated
    ) {
      return {
        data: paginated.data as unknown,
        meta: {
          request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
          cursor: null,
          next_cursor: paginated.nextCursor ?? null,
          has_more: paginated.hasMore ?? false,
          version: this.options.version ?? '2026-04-01',
        },
        links: { self: path },
      }
    }
    return {
      data: data as unknown,
      meta: {
        request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
        cursor: null,
        next_cursor: null,
        has_more: false,
        version: this.options.version ?? '2026-04-01',
      },
      links: { self: path },
    }
  }

  private errorCodeToStatus(code: string): number {
    const map: Record<string, number> = {
      AUTH_INVALID_API_KEY: 401,
      AUTH_INSUFFICIENT_SCOPE: 403,
      AUTH_CONTEXT_REQUIRED: 401,
      RATE_LIMITED: 429,
      VALIDATION_FAILED: 400,
      INVALID_CURSOR: 400,
      RESOURCE_NOT_FOUND: 404,
      RELATION_NOT_FOUND: 404,
      CONFLICT: 409,
      IDEMPOTENCY_CONFLICT: 409,
      SCHEMA_INVALID_FIELD: 400,
      SCHEMA_ENTITY_EXISTS: 409,
      SCHEMA_DESTRUCTIVE_BLOCKED: 403,
      SCHEMA_INCOMPATIBLE_PROMOTION: 400,
      MIGRATION_FAILED: 500,
      ADAPTER_UNAVAILABLE: 503,
      ADAPTER_TRANSACTION_FAILED: 500,
      RLS_GENERATION_FAILED: 500,
      WEBHOOK_DELIVERY_FAILED: 502,
      INTERNAL_ERROR: 500,
    }
    return map[code] ?? 500
  }
}
