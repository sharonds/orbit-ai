import { createCoreServices, resolvePublicEntityServiceKey, type OrbitEnvelope, type OrbitAuthContext, type OrbitErrorCode } from '@orbit-ai/core'
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
      if (err instanceof OrbitApiError) {
        throw new OrbitApiError(enrichDirectErrorShape(err.error), err.status)
      }
      if (isZodValidationError(err)) {
        throw new OrbitApiError(
          enrichDirectErrorShape({
            code: 'VALIDATION_FAILED',
            message: 'Request body failed validation',
            hint: err.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; '),
          }),
          400,
        )
      }
      const orbitErr = err as { code?: string; message?: string; field?: string; retryable?: boolean; request_id?: string; doc_url?: string; hint?: string; recovery?: string }
      if (orbitErr.code) {
        const code = orbitErr.code as OrbitErrorCode
        throw new OrbitApiError(
          enrichDirectErrorShape({
            code,
            message: orbitErr.message ?? 'Unknown error',
            field: orbitErr.field,
            request_id: orbitErr.request_id ?? createDirectRequestId(),
            doc_url: orbitErr.doc_url ?? directErrorDocUrl(code),
            hint: orbitErr.hint,
            recovery: orbitErr.recovery,
            retryable: orbitErr.retryable,
          }),
          this.errorCodeToStatus(code),
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

    if (!entity) throw new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: `Unknown path: ${path}` }, 404)

    // Special routes
    if (method === 'POST' && entity === 'search') {
      return this.services.search.search(this.ctx, body as Parameters<typeof this.services.search.search>[1])
    }
    if (method === 'GET' && entity === 'context' && action) {
      return this.services.contactContext.getContactContext(this.ctx, { contactId: action })
    }

    // Schema / objects routes — delegated to OrbitSchemaEngine
    if (entity === 'objects') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = (this.services as any).schema as {
        listObjects?: (ctx: OrbitAuthContext) => Promise<unknown>
        getObject?: (ctx: OrbitAuthContext, type: string) => Promise<unknown>
        addField?: (ctx: OrbitAuthContext, type: string, body: Record<string, unknown>) => Promise<unknown>
        updateField?: (ctx: OrbitAuthContext, type: string, fieldName: string, body: Record<string, unknown>) => Promise<unknown>
        deleteField?: (ctx: OrbitAuthContext, type: string, fieldName: string) => Promise<unknown>
      }
      const subEntity = segments[startIdx + 2] // e.g. 'fields'
      const subAction = segments[startIdx + 3] // e.g. field name
      if (method === 'GET' && !action) {
        if (typeof schema.listObjects !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: listObjects not implemented' }, 501)
        const result = await schema.listObjects(this.ctx)
        return Array.isArray(result) ? result.map(sanitizeSchemaMetadataRead) : sanitizeSchemaMetadataRead(result)
      }
      if (method === 'GET' && action && !subEntity) {
        if (typeof schema.getObject !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: getObject not implemented' }, 501)
        const result = await schema.getObject(this.ctx, action)
        if (result === null || result === undefined) {
          throw new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: `Object type '${action}' not found` }, 404)
        }
        return sanitizeSchemaMetadataRead(result)
      }
      if (method === 'POST' && action && subEntity === 'fields') {
        if (typeof schema.addField !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: addField not implemented' }, 501)
        return sanitizeSchemaMetadataRead(await schema.addField(this.ctx, action, this.bodyObject(body, path)))
      }
      if (method === 'PATCH' && action && subEntity === 'fields' && subAction) {
        if (typeof schema.updateField !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: updateField not implemented' }, 501)
        return sanitizeSchemaMetadataRead(await schema.updateField(this.ctx, action, subAction, this.bodyObject(body, path)))
      }
      if (method === 'DELETE' && action && subEntity === 'fields' && subAction) {
        if (typeof schema.deleteField !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: deleteField not implemented' }, 501)
        await schema.deleteField(this.ctx, action, subAction)
        return { deleted: true, field: subAction }
      }
      throw new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: `Unhandled schema route: ${method} ${path}` }, 404)
    }

    // Schema migration routes: /v1/schema/migrations/preview|apply|:id/rollback
    if (entity === 'schema' && action === 'migrations') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = (this.services as any).schema as {
        preview?: (ctx: OrbitAuthContext, data: Record<string, unknown>) => Promise<unknown>
        apply?: (ctx: OrbitAuthContext, data: Record<string, unknown>) => Promise<unknown>
        rollback?: (ctx: OrbitAuthContext, id: string) => Promise<unknown>
      }
      const operation = segments[startIdx + 2] // 'preview', 'apply', or migration id
      const subOp = segments[startIdx + 3] // 'rollback' when id is present
      if (method === 'POST' && operation === 'preview') {
        if (typeof schema.preview !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: preview not implemented' }, 501)
        return sanitizeSchemaMetadataRead(await schema.preview(this.ctx, this.migrationBody(body, path)))
      }
      if (method === 'POST' && operation === 'apply') {
        if (typeof schema.apply !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: apply not implemented' }, 501)
        return sanitizeSchemaMetadataRead(await schema.apply(this.ctx, this.migrationBody(body, path)))
      }
      if (method === 'POST' && subOp === 'rollback' && operation) {
        if (typeof schema.rollback !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Schema engine: rollback not implemented' }, 501)
        return sanitizeSchemaMetadataRead(await schema.rollback(this.ctx, operation))
      }
      throw new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: `Unhandled schema migration route: ${method} ${path}` }, 404)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceKey = resolvePublicEntityServiceKey(entity)
    const service = (this.services as any)[serviceKey] as
      | {
        list?: Function
        create?: Function
        get?: Function
        update?: Function
        delete?: Function
        search?: Function
        batch?: Function
        move?: Function
        pipeline?: Function
        stats?: Function
        enroll?: Function
        unenroll?: Function
        attach?: Function
        detach?: Function
        log?: Function
      }
      | undefined
    if (!service) throw new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: `Unknown entity: ${entity}` }, 404)

    const coreInput = body && typeof body === 'object' && !Array.isArray(body)
      ? deserializeEntityInput(entity, body as Record<string, unknown>)
      : body

    if (entity === 'deals' && method === 'POST' && action && segments[startIdx + 2] === 'move') {
      const input = this.camelizeBody(this.bodyObject(body, path))
      if (typeof service.move === 'function') return service.move(this.ctx, action, input)
      throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Deal move not implemented' }, 501)
    }
    if (entity === 'deals' && method === 'GET' && action === 'pipeline') {
      if (typeof service.pipeline === 'function') return service.pipeline(this.ctx)
      throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Deal pipeline view not implemented' }, 501)
    }
    if (entity === 'deals' && method === 'GET' && action === 'stats') {
      if (typeof service.stats === 'function') return service.stats(this.ctx)
      throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Deal stats not implemented' }, 501)
    }
    if (entity === 'sequences' && method === 'POST' && action && segments[startIdx + 2] === 'enroll') {
      const input: Record<string, unknown> = { ...this.camelizeBody(this.bodyObject(body, path)), sequenceId: action }
      if (typeof service.enroll === 'function') return service.enroll(this.ctx, action, input)
      if (typeof input.contactId !== 'string' || input.contactId.length === 0) {
        throw new OrbitApiError({ code: 'VALIDATION_FAILED', message: 'Sequence enrollment contactId is required', field: 'contactId' }, 400)
      }
      return this.services.sequenceEnrollments.create(this.ctx, input as Parameters<typeof this.services.sequenceEnrollments.create>[1])
    }
    if (entity === 'sequence_enrollments' && method === 'POST' && action && segments[startIdx + 2] === 'unenroll') {
      if (typeof service.unenroll === 'function') return service.unenroll(this.ctx, action)
      if (typeof service.update !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Sequence unenrollment not implemented' }, 501)
      return service.update(this.ctx, action, {
        status: 'exited',
        exitedAt: new Date(),
        exitReason: 'unenrolled',
      })
    }
    if (entity === 'tags' && method === 'POST' && action && segments[startIdx + 2] === 'attach') {
      if (typeof service.attach !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Tag attach not implemented' }, 501)
      return service.attach(this.ctx, action, this.camelizeBody(this.bodyObject(body, path)))
    }
    if (entity === 'tags' && method === 'POST' && action && segments[startIdx + 2] === 'detach') {
      if (typeof service.detach !== 'function') throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Tag detach not implemented' }, 501)
      return service.detach(this.ctx, action, this.camelizeBody(this.bodyObject(body, path)))
    }
    if (entity === 'activities' && method === 'POST' && action === 'log') {
      const input = this.camelizeBody(this.bodyObject(body, path))
      if (typeof service.log === 'function') return service.log(this.ctx, input)
      if (typeof service.create === 'function') return service.create(this.ctx, input)
      throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'Activity log not implemented' }, 501)
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

    throw new OrbitApiError({ code: 'RESOURCE_NOT_FOUND', message: `Unhandled route: ${method} ${path}` }, 404)
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
    if (entity === 'objects' || entity === 'schema') return null
    if (entity === 'deals' && (action === 'pipeline' || action === 'stats')) return null
    if (entity === 'deals' && verb === 'move') return 'deals'
    if (entity === 'sequences' && verb === 'enroll') return 'sequence_enrollments'
    if (entity === 'sequence_enrollments' && verb === 'unenroll') return 'sequence_enrollments'
    if (entity === 'tags' && verb === 'attach') return 'entity_tags'
    if (entity === 'tags' && verb === 'detach') return null
    if (entity === 'activities' && action === 'log') return 'activities'

    return entity
  }

  private bodyObject(body: unknown, path: string): Record<string, unknown> {
    if (body === undefined || body === null) return {}
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw new OrbitApiError({ code: 'VALIDATION_FAILED', message: `Request body for ${path} must be an object` }, 400)
    }
    return body as Record<string, unknown>
  }

  private migrationBody(body: unknown, path: string): Record<string, unknown> {
    const data = this.bodyObject(body, path)
    if (Object.keys(data).length === 0) {
      throw new OrbitApiError({
        code: 'VALIDATION_FAILED',
        message: 'Invalid migration input',
        hint: '(root): Migration input must include at least one field',
      }, 400)
    }
    return data
  }

  private camelizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      const camelKey = key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
      if (camelKey.endsWith('At') && typeof value === 'string') {
        result[camelKey] = new Date(value)
      } else {
        result[camelKey] = value
      }
    }
    return result
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
          request_id: createDirectRequestId(),
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
        request_id: createDirectRequestId(),
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

interface ZodIssueLike {
  readonly path: Array<string | number>
  readonly message: string
}

interface ZodValidationErrorLike extends Error {
  readonly issues: ZodIssueLike[]
}

function isZodValidationError(err: unknown): err is ZodValidationErrorLike {
  if (!(err instanceof Error) || err.name !== 'ZodError') return false
  const issues = (err as Error & { issues?: unknown }).issues
  return Array.isArray(issues) &&
    issues.every((issue) => {
      if (!issue || typeof issue !== 'object') return false
      const record = issue as Record<string, unknown>
      return Array.isArray(record.path) && typeof record.message === 'string'
    })
}

function sanitizeSchemaMetadataRead(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith('_')) continue
    out[key] = value
  }
  return out
}

function createDirectRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`
}

function directErrorDocUrl(code: OrbitErrorCode): string {
  return `https://orbit-ai.dev/docs/errors#${code.toLowerCase()}`
}

function enrichDirectErrorShape(error: OrbitApiError['error']): OrbitApiError['error'] {
  return {
    ...error,
    request_id: error.request_id ?? createDirectRequestId(),
    doc_url: error.doc_url ?? directErrorDocUrl(error.code),
    retryable: error.retryable ?? false,
  }
}
