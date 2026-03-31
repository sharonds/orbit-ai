# Spec 3: `@orbit-ai/sdk`

Status: Ready for implementation
Package: `packages/sdk`
Depends on: `@orbit-ai/core`, optionally `@orbit-ai/api`

## 1. Scope

`@orbit-ai/sdk` is the embeddable TypeScript client for Orbit. It must support two modes:

- API mode: API key over HTTP against `@orbit-ai/api`
- Direct mode: direct database access through `@orbit-ai/core` services and a configured adapter

The public API must stay identical across both modes.

## 2. Package Structure

```text
packages/sdk/
├── src/
│   ├── client.ts
│   ├── config.ts
│   ├── errors.ts
│   ├── search.ts
│   ├── transport/
│   │   ├── index.ts
│   │   ├── http-transport.ts
│   │   └── direct-transport.ts
│   ├── resources/
│   │   ├── base-resource.ts
│   │   ├── contacts.ts
│   │   ├── companies.ts
│   │   ├── deals.ts
│   │   ├── pipelines.ts
│   │   ├── stages.ts
│   │   ├── activities.ts
│   │   ├── tasks.ts
│   │   ├── notes.ts
│   │   ├── products.ts
│   │   ├── payments.ts
│   │   ├── contracts.ts
│   │   ├── sequences.ts
│   │   ├── sequence-steps.ts
│   │   ├── sequence-enrollments.ts
│   │   ├── sequence-events.ts
│   │   ├── tags.ts
│   │   ├── schema.ts
│   │   ├── webhooks.ts
│   │   ├── imports.ts
│   │   └── users.ts
│   ├── pagination.ts
│   ├── retries.ts
│   └── index.ts
└── package.json
```

## 3. Public Client

```typescript
// packages/sdk/src/client.ts
import { ContactResource } from './resources/contacts'
import { CompanyResource } from './resources/companies'
import { DealResource } from './resources/deals'
import { StageResource } from './resources/stages'
import { ActivityResource } from './resources/activities'
import { TaskResource } from './resources/tasks'
import { NoteResource } from './resources/notes'
import { ProductResource } from './resources/products'
import { PaymentResource } from './resources/payments'
import { ContractResource } from './resources/contracts'
import { SequenceResource } from './resources/sequences'
import { SequenceStepResource } from './resources/sequence-steps'
import { SequenceEnrollmentResource } from './resources/sequence-enrollments'
import { SequenceEventResource } from './resources/sequence-events'
import { PipelineResource } from './resources/pipelines'
import { TagResource } from './resources/tags'
import { SchemaResource } from './resources/schema'
import { WebhookResource } from './resources/webhooks'
import { ImportResource } from './resources/imports'
import { UserResource } from './resources/users'
import { SearchResource } from './search'
import { createTransport } from './transport'

export interface OrbitClientOptions {
  apiKey?: string
  baseUrl?: string
  adapter?: import('@orbit-ai/core').StorageAdapter
  context?: {
    userId?: string
    orgId: string
  }
  version?: string
  timeoutMs?: number
  maxRetries?: number
}

export class OrbitClient {
  readonly contacts: ContactResource
  readonly companies: CompanyResource
  readonly deals: DealResource
  readonly stages: StageResource
  readonly activities: ActivityResource
  readonly tasks: TaskResource
  readonly notes: NoteResource
  readonly products: ProductResource
  readonly payments: PaymentResource
  readonly contracts: ContractResource
  readonly sequences: SequenceResource
  readonly sequenceSteps: SequenceStepResource
  readonly sequenceEnrollments: SequenceEnrollmentResource
  readonly sequenceEvents: SequenceEventResource
  readonly pipelines: PipelineResource
  readonly tags: TagResource
  readonly schema: SchemaResource
  readonly webhooks: WebhookResource
  readonly imports: ImportResource
  readonly users: UserResource
  readonly search: SearchResource

  constructor(public readonly options: OrbitClientOptions) {
    const transport = createTransport(options)
    this.contacts = new ContactResource(transport)
    this.companies = new CompanyResource(transport)
    this.deals = new DealResource(transport)
    this.stages = new StageResource(transport)
    this.activities = new ActivityResource(transport)
    this.tasks = new TaskResource(transport)
    this.notes = new NoteResource(transport)
    this.products = new ProductResource(transport)
    this.payments = new PaymentResource(transport)
    this.contracts = new ContractResource(transport)
    this.sequences = new SequenceResource(transport)
    this.sequenceSteps = new SequenceStepResource(transport)
    this.sequenceEnrollments = new SequenceEnrollmentResource(transport)
    this.sequenceEvents = new SequenceEventResource(transport)
    this.pipelines = new PipelineResource(transport)
    this.tags = new TagResource(transport)
    this.schema = new SchemaResource(transport)
    this.webhooks = new WebhookResource(transport)
    this.imports = new ImportResource(transport)
    this.users = new UserResource(transport)
    this.search = new SearchResource(transport)
  }
}
```

```typescript
// packages/sdk/src/search.ts
export class SearchResource {
  constructor(private readonly transport: import('./transport').OrbitTransport) {}

  query(input: {
    query: string
    object_types?: string[]
    limit?: number
    cursor?: string
  }) {
    return this.transport.request({
      method: 'POST',
      path: '/v1/search',
      body: input,
    })
  }
}
```

## 4. Transport Contract

```typescript
// packages/sdk/src/transport/index.ts
import type { ListQuery, OrbitEnvelope } from '@orbit-ai/core'

export interface OrbitTransport {
  request<T>(input: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    path: string
    query?: Record<string, unknown>
    body?: unknown
    headers?: Record<string, string>
  }): Promise<OrbitEnvelope<T>>
}
```

### 4.1 HTTP Transport

```typescript
// packages/sdk/src/transport/http-transport.ts
import { OrbitApiError } from '../errors'
import { retry } from '../retries'
import type { OrbitTransport } from './index'
import type { OrbitClientOptions } from '../client'

export class HttpTransport implements OrbitTransport {
  constructor(private readonly options: OrbitClientOptions) {}

  async request<T>(input: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    path: string
    query?: Record<string, unknown>
    body?: unknown
    headers?: Record<string, string>
  }) {
    return retry(async () => {
      const url = new URL(input.path, this.options.baseUrl ?? 'http://localhost:3000')
      if (input.query) {
        for (const [key, value] of Object.entries(input.query)) {
          if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
        }
      }

      const response = await fetch(url, {
        method: input.method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
          'orbit-version': this.options.version ?? '2026-04-01',
          'idempotency-key': input.method === 'GET' ? '' : crypto.randomUUID(),
          ...input.headers,
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
      })

      if (!response.ok) {
        throw await OrbitApiError.fromResponse(response)
      }

      return (await response.json()) as Promise<import('@orbit-ai/core').OrbitEnvelope<T>>
    }, { maxRetries: this.options.maxRetries ?? 2 })
  }
}
```

### 4.2 Direct Transport

```typescript
// packages/sdk/src/transport/direct-transport.ts
import { createCoreServices, type StorageAdapter } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../client'
import type { OrbitTransport } from './index'

export class DirectTransport implements OrbitTransport {
  private readonly services

  constructor(private readonly options: OrbitClientOptions) {
    if (!options.adapter || !options.context?.orgId) {
      throw new Error('Direct transport requires adapter and context.orgId')
    }
    this.services = createCoreServices(options.adapter)
  }

  async request<T>(input: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    path: string
    query?: Record<string, unknown>
    body?: unknown
  }): Promise<import('@orbit-ai/core').OrbitEnvelope<T>> {
    return dispatchDirectRequest<T>(this.services, this.options.context!, input)
  }
}
```

`dispatchDirectRequest()` maps canonical SDK paths like `/v1/contacts` and `/v1/deals/:id/move` to the matching core service methods.

## 5. Resource Base Class

```typescript
// packages/sdk/src/resources/base-resource.ts
import type { OrbitTransport } from '../transport'
import type { ListQuery } from '@orbit-ai/core'
import { AutoPager } from '../pagination'

export class BaseResource<TRecord, TCreate, TUpdate> {
  constructor(
    protected readonly transport: OrbitTransport,
    protected readonly basePath: string,
  ) {}

  create(input: TCreate) {
    return this.transport.request<TRecord>({ method: 'POST', path: this.basePath, body: input })
  }

  get(id: string, include?: string[]) {
    return this.transport.request<TRecord>({
      method: 'GET',
      path: `${this.basePath}/${id}`,
      query: include?.length ? { include: include.join(',') } : undefined,
    })
  }

  update(id: string, input: TUpdate) {
    return this.transport.request<TRecord>({ method: 'PATCH', path: `${this.basePath}/${id}`, body: input })
  }

  delete(id: string) {
    return this.transport.request<{ id: string; deleted: true }>({
      method: 'DELETE',
      path: `${this.basePath}/${id}`,
    })
  }

  list(query: ListQuery = {}) {
    return new AutoPager<TRecord>(this.transport, this.basePath, query)
  }

  search(body: Record<string, unknown>) {
    return this.transport.request<TRecord[]>({
      method: 'POST',
      path: `${this.basePath}/search`,
      body,
    })
  }
}
```

## 6. Typed Resource Interfaces

### 6.1 Contacts

```typescript
// packages/sdk/src/resources/contacts.ts
import { BaseResource } from './base-resource'

export interface ContactRecord {
  id: string
  object: 'contact'
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  source_channel: string | null
  status: string
  company_id: string | null
  assigned_to_user_id: string | null
  lead_score: number
  is_hot: boolean
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  included?: {
    company?: unknown
    tags?: unknown[]
    open_deals?: unknown[]
  }
}

export interface CreateContactInput {
  name: string
  email?: string
  phone?: string
  title?: string
  source_channel?: string
  status?: string
  company_id?: string
  assigned_to_user_id?: string
  lead_score?: number
  is_hot?: boolean
  custom_fields?: Record<string, unknown>
}

export interface UpdateContactInput extends Partial<CreateContactInput> {}

export class ContactResource extends BaseResource<ContactRecord, CreateContactInput, UpdateContactInput> {
  constructor(transport: import('../transport').OrbitTransport) {
    super(transport, '/v1/contacts')
  }

  context(idOrEmail: string) {
    return this.transport.request({
      method: 'GET',
      path: `/v1/context/${idOrEmail}`,
    })
  }
}
```

### 6.2 Deals

```typescript
// packages/sdk/src/resources/deals.ts
import { BaseResource } from './base-resource'

export interface DealRecord {
  id: string
  object: 'deal'
  organization_id: string
  title: string
  value: string | null
  currency: string
  stage_id: string | null
  pipeline_id: string | null
  probability: number
  expected_close_date: string | null
  contact_id: string | null
  company_id: string | null
  assigned_to_user_id: string | null
  status: string
  won_at: string | null
  lost_at: string | null
  lost_reason: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MoveDealStageInput {
  stage_id: string
  occurred_at?: string
  note?: string
}

export class DealResource extends BaseResource<DealRecord, Record<string, unknown>, Record<string, unknown>> {
  constructor(transport: import('../transport').OrbitTransport) {
    super(transport, '/v1/deals')
  }

  move(id: string, input: MoveDealStageInput) {
    return this.transport.request<DealRecord>({
      method: 'POST',
      path: `/v1/deals/${id}/move`,
      body: input,
    })
  }

  pipeline(query: Record<string, unknown> = {}) {
    return this.transport.request({ method: 'GET', path: '/v1/deals/pipeline', query })
  }

  stats(query: Record<string, unknown> = {}) {
    return this.transport.request({ method: 'GET', path: '/v1/deals/stats', query })
  }
}
```

### 6.3 Schema

```typescript
// packages/sdk/src/resources/schema.ts
export interface AddFieldInput {
  entity_type: string
  field_name: string
  field_type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'multi_select' | 'url' | 'email' | 'phone' | 'currency' | 'relation'
  label: string
  is_required?: boolean
  options?: string[]
  validation?: Record<string, unknown>
}

export class SchemaResource {
  constructor(private readonly transport: import('../transport').OrbitTransport) {}

  listObjects() {
    return this.transport.request({ method: 'GET', path: '/v1/objects' })
  }

  describeObject(type: string) {
    return this.transport.request({ method: 'GET', path: `/v1/objects/${type}` })
  }

  addField(type: string, input: AddFieldInput) {
    return this.transport.request({
      method: 'POST',
      path: `/v1/objects/${type}/fields`,
      body: input,
    })
  }

  updateField(type: string, fieldName: string, input: Partial<AddFieldInput>) {
    return this.transport.request({
      method: 'PATCH',
      path: `/v1/objects/${type}/fields/${fieldName}`,
      body: input,
    })
  }

  previewMigration(body: Record<string, unknown>) {
    return this.transport.request({
      method: 'POST',
      path: '/v1/schema/migrations/preview',
      body,
    })
  }
}
```

## 7. Auto-Pagination

```typescript
// packages/sdk/src/pagination.ts
import type { ListQuery, OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitTransport } from './transport'

export class AutoPager<T> {
  constructor(
    private readonly transport: OrbitTransport,
    private readonly path: string,
    private readonly initialQuery: ListQuery,
  ) {}

  async firstPage() {
    return this.transport.request<T[]>({
      method: 'GET',
      path: this.path,
      query: serializeListQuery(this.initialQuery),
    })
  }

  async *autoPaginate(): AsyncGenerator<T, void, undefined> {
    let cursor = this.initialQuery.cursor
    for (;;) {
      const page = await this.transport.request<T[]>({
        method: 'GET',
        path: this.path,
        query: serializeListQuery({ ...this.initialQuery, cursor }),
      })
      for (const row of page.data) yield row
      if (!page.meta.has_more || !page.meta.next_cursor) return
      cursor = page.meta.next_cursor
    }
  }
}
```

## 8. Errors

```typescript
// packages/sdk/src/errors.ts
import type { OrbitErrorShape } from '@orbit-ai/core'

export class OrbitApiError extends Error {
  constructor(public readonly error: OrbitErrorShape, public readonly status: number) {
    super(error.message)
  }

  static async fromResponse(response: Response) {
    const body = await response.json() as { error: OrbitErrorShape }
    return new OrbitApiError(body.error, response.status)
  }
}
```

SDK behavior:

- retry on `RATE_LIMITED`, `WEBHOOK_DELIVERY_FAILED`, `INTERNAL_ERROR` where `retryable` is `true`
- do not retry `VALIDATION_FAILED`, `AUTH_*`, or `SCHEMA_DESTRUCTIVE_BLOCKED`

Resource coverage requirements:

- every public API entity gets a dedicated resource class
- system entities may use admin resources under `client.admin.*` in a later phase, but `webhooks`, `imports`, `users`, `tags`, `stages`, and all sequence sub-entities are part of MVP

## 9. Retry Policy

```typescript
// packages/sdk/src/retries.ts
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number },
): Promise<T> {
  let attempt = 0
  let delayMs = 250
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      const shouldRetry =
        error instanceof OrbitApiError &&
        error.error.retryable === true &&
        attempt < options.maxRetries

      if (!shouldRetry) throw error

      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempt += 1
      delayMs *= 2
    }
  }
}
```

## 10. Direct Mode Semantics

Direct mode uses the same public resources, but:

- no HTTP serialization layer
- no API key required
- `context.orgId` is mandatory
- idempotency is still enforced via core `idempotency_keys`
- request envelope is synthesized locally to keep return types identical

This allows:

```typescript
import { createSupabaseAdapter } from '@orbit-ai/core/adapters/supabase'
import { OrbitClient } from '@orbit-ai/sdk'

const adapter = createSupabaseAdapter({ databaseUrl: process.env.DATABASE_URL! })
const crm = new OrbitClient({
  adapter,
  context: { orgId: 'org_01...', userId: 'user_01...' },
})
```

## 11. Events

The SDK exposes a lightweight event emitter for local hooks.

```typescript
// packages/sdk/src/client.ts
import { EventEmitter } from 'eventemitter3'

export class OrbitClient extends EventEmitter<{
  'contact.created': [unknown]
  'deal.updated': [unknown]
  'task.completed': [unknown]
}> {
  // same properties as above
}
```

The emitter is local-only. It mirrors client-side actions and does not replace webhooks.

## 12. Acceptance Criteria

1. One `OrbitClient` works unchanged in API and direct modes.
2. Contacts, companies, deals, activities, tasks, notes, products, payments, contracts, sequences, pipelines, schema, webhooks, and users each expose resource classes.
3. `list().autoPaginate()` works across both transports.
4. Errors surface as typed `OrbitApiError` with shared Orbit error codes.
5. Retries, idempotency, and version headers are applied automatically.
6. Resource interfaces use real TypeScript types, not `any`.
