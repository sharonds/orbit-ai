import { createCoreServices, resolvePublicEntityServiceKey, type OrbitEnvelope, type OrbitAuthContext } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'
import type { OrbitTransport, TransportRequest } from './index.js'
import { OrbitApiError } from '../errors.js'
import { serializeEntityRecord, deserializeEntityInput, serializeSearchPage, serializeSearchResult } from './serialization.js'

/**
 * In-process transport for the Orbit AI SDK.
 *
 * @security **TRUSTED-CALLER ONLY — this transport bypasses API middleware.**
 *
 * DirectTransport dispatches requests straight to core services inside the
 * current process. It does NOT run any of the following middleware that
 * `@orbit-ai/api` applies to HTTP requests:
 *
 * - Webhook URL SSRF validation (`validateWebhookUrl`)
 * - Scope enforcement (`requireScope`)
 * - Idempotency key handling
 * - Rate limiting
 * - Request body size limits
 * - API version pinning
 * - Tenant auth context derivation from API keys
 *
 * This is fine when the SDK caller is a trusted server-side application
 * passing its own trusted inputs (e.g. a Next.js backend using DirectTransport
 * against an embedded SQLite adapter for tests, or a CLI tool).
 *
 * It is NOT fine when ANY of these are true:
 * - You forward user-supplied webhook URLs through this transport
 *   (SSRF: a malicious user could target `http://169.254.169.254/` or
 *    internal services).
 * - You expose DirectTransport to multi-tenant end-users without enforcing
 *   scopes at your application layer (privilege escalation).
 * - You need idempotency guarantees across retries (they will not replay).
 * - You need rate limiting (there is none).
 *
 * If any of the above apply, use {@link HttpTransport} with a real API server
 * instead — it applies the full middleware chain.
 *
 * Tracked for refactor: extract the SSRF validation + scope check functions
 * from `@orbit-ai/api` into a shared layer both transports can call.
 */

/** @deprecated Use `resolvePublicEntityServiceKey` from `@orbit-ai/core` directly. */
export function resolveServiceKey(entity: string): string {
  return resolvePublicEntityServiceKey(entity)
}

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
      return this.wrapEnvelope(input.method, input.path, input.query, result) as OrbitEnvelope<T>
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
    const verb = segments[startIdx + 2] // present for 4-segment workflow routes

    if (!entity) throw new Error(`Unknown path: ${path}`)

    // Special routes
    if (method === 'POST' && entity === 'search') {
      return this.services.search.search(this.ctx, body as Parameters<typeof this.services.search.search>[1])
    }
    if (method === 'GET' && entity === 'context' && action) {
      return this.services.contactContext.getContactContext(this.ctx, { contactId: action })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceKey = resolvePublicEntityServiceKey(entity)
    const service = (this.services as any)[serviceKey] as
      | { list?: Function; create?: Function; get?: Function; update?: Function; delete?: Function; search?: Function; batch?: Function; move?: Function; pipeline?: Function; stats?: Function; enroll?: Function; unenroll?: Function; attach?: Function; detach?: Function; log?: Function }
      | undefined
    if (!service) throw new Error(`Unknown entity: ${entity}`)

    const coreInput = body && typeof body === 'object' && !Array.isArray(body)
      ? deserializeEntityInput(entity, body as Record<string, unknown>)
      : body

    if (method === 'GET' && entity === 'deals' && action === 'pipeline') {
      if (typeof service.pipeline === 'function') return service.pipeline(this.ctx, query ?? {})
      throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Deal pipeline view not implemented' }, 501)
    }
    if (method === 'GET' && entity === 'deals' && action === 'stats') {
      if (typeof service.stats === 'function') return service.stats(this.ctx, query ?? {})
      throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Deal stats not implemented' }, 501)
    }

    // 4-segment workflow routes: POST /v1/:entity/:id/:verb
    if (method === 'POST' && action && verb) {
      if (verb === 'move' && typeof service.move === 'function') return service.move(this.ctx, action, coreInput)
      if (verb === 'enroll' && typeof service.enroll === 'function') return service.enroll(this.ctx, action, body)
      if (verb === 'unenroll' && typeof service.unenroll === 'function') return service.unenroll(this.ctx, action)
      if (verb === 'attach' && typeof service.attach === 'function') return service.attach(this.ctx, action, body)
      if (verb === 'detach' && typeof service.detach === 'function') return service.detach(this.ctx, action, body)
      throw new Error(`Unhandled workflow: ${method} ${path}`)
    }

    if (method === 'GET' && !action && service.list) return service.list(this.ctx, query ?? {})
    if (method === 'POST' && !action && service.create) return service.create(this.ctx, coreInput)
    if (method === 'POST' && action === 'log') {
      if (typeof service.log === 'function') return service.log(this.ctx, coreInput)
      if (typeof service.create === 'function') return service.create(this.ctx, coreInput)
    }
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
    if (method === 'PATCH' && action && service.update) return service.update(this.ctx, action, coreInput)
    if (method === 'DELETE' && action && service.delete) {
      await service.delete(this.ctx, action)
      return { id: action, deleted: true }
    }
    if (method === 'POST' && action === 'search' && service.search) return service.search(this.ctx, body)
    if (method === 'POST' && action === 'batch' && typeof service.batch === 'function') return service.batch(this.ctx, body)

    throw new Error(`Unhandled dispatch: ${method} ${path}`)
  }

  private serializeResult(path: string, data: unknown): unknown {
    const entity = this.responseEntityForPath(path)
    if (entity === undefined) {
      console.error(`[orbit/sdk] serializeResult: could not extract entity from path "${path}", returning raw data`)
      return data
    }
    if (entity === null) return data
    if (entity === 'search') {
      return data && typeof data === 'object' && !Array.isArray(data)
        ? serializeSearchResult(data as Record<string, unknown>)
        : data
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return data
    }
    // Pass through stub responses (delete confirmations etc.) without entity serialization
    const rec = data as Record<string, unknown>
    if ('deleted' in rec && rec.deleted === true) {
      return data
    }
    return serializeEntityRecord(entity, rec)
  }

  private serializePage(path: string, rows: unknown[]): unknown[] {
    const entity = this.responseEntityForPath(path)
    if (entity === undefined) {
      console.error(`[orbit/sdk] serializePage: could not extract entity from path "${path}", returning raw rows`)
      return rows
    }
    if (entity === null) return rows
    if (entity === 'search') return serializeSearchPage(rows)
    return rows.map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? serializeEntityRecord(entity, row as Record<string, unknown>)
        : row,
    )
  }

  private responseEntityForPath(path: string): string | null | undefined {
    const segments = path.split('/').filter(Boolean)
    const startIdx = segments[0] === 'v1' ? 1 : 0
    const entity = segments[startIdx]
    const action = segments[startIdx + 1]
    const verb = segments[startIdx + 2]
    if (!entity) return undefined

    if (entity === 'search') return 'search'
    if (entity === 'deals' && (action === 'pipeline' || action === 'stats')) return null
    if (entity === 'deals' && verb === 'move') return 'deals'
    if (entity === 'sequences' && verb === 'enroll') return 'sequence_enrollments'
    if (entity === 'sequence_enrollments' && verb === 'unenroll') return 'sequence_enrollments'
    if (entity === 'tags' && verb === 'attach') return 'entity_tags'
    if (entity === 'tags' && verb === 'detach') return null
    if (entity === 'activities' && action === 'log') return 'activities'

    return entity
  }

  private wrapEnvelope(
    method: string,
    path: string,
    query: Record<string, unknown> | undefined,
    data: unknown,
  ): OrbitEnvelope<unknown> {
    const paginated = data as { data?: unknown[]; nextCursor?: string | null; hasMore?: boolean }
    if (
      paginated &&
      typeof paginated === 'object' &&
      'data' in paginated &&
      'hasMore' in paginated
    ) {
      const nextCursor = paginated.nextCursor ?? null
      const links: { self: string; next?: string } = { self: path }
      if (nextCursor !== null && !this.shouldOmitNextLink(method, path)) {
        const params = new URLSearchParams()
        if (query?.limit !== undefined) params.set('limit', String(query.limit))
        if (query?.include !== undefined) params.set('include', String(query.include))
        params.set('cursor', nextCursor)
        links.next = `${path}?${params.toString()}`
      }
      return {
        data: this.serializePage(path, (paginated.data as unknown[]) ?? []),
        meta: {
          request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
          cursor: null,
          next_cursor: nextCursor,
          has_more: paginated.hasMore ?? false,
          version: this.options.version ?? '2026-04-01',
        },
        links,
      }
    }
    return {
      data: this.serializeResult(path, data),
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

  private shouldOmitNextLink(method: string, path: string): boolean {
    if (method !== 'POST') return false

    const segments = path.split('/').filter(Boolean)
    const startIdx = segments[0] === 'v1' ? 1 : 0

    return segments[startIdx] === 'search' || segments[startIdx + 1] === 'search'
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
      SEARCH_RESULT_TOO_LARGE: 400,
      PAYLOAD_TOO_LARGE: 413,
      INTERNAL_ERROR: 500,
    }
    return map[code] ?? 500
  }
}
