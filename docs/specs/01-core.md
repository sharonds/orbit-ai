# Spec 1: `@orbit-ai/core`

Status: Ready for implementation
Package: `packages/core`
Depends on: nothing
Blocks: `@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/cli`, `@orbit-ai/mcp`, `@orbit-ai/integrations`

## 1. Scope

`@orbit-ai/core` is the canonical domain layer for Orbit AI. It owns:

- Base Drizzle schema for every first-party entity
- ID generation and parsing for type-prefixed ULIDs
- Shared types used by every other package
- Storage adapter interfaces and concrete adapter contracts
- CRUD services with tenant scoping
- Schema engine for custom fields and agent-safe migrations
- RLS policy generation for Postgres-family adapters
- Audit logging, idempotency, pagination, and contact context aggregation

This package must build with no dependency on Hono, Commander, Ink, or MCP SDK types.

## 2. Package Structure

```text
packages/core/
├── src/
│   ├── adapters/
│   │   ├── interface.ts
│   │   ├── postgres/
│   │   ├── supabase/
│   │   ├── neon/
│   │   └── sqlite/
│   ├── entities/
│   │   ├── contacts/
│   │   │   ├── AGENTS.MD
│   │   │   ├── repository.ts
│   │   │   ├── service.ts
│   │   │   └── validators.ts
│   │   └── ...same pattern for all entities
│   ├── ids/
│   │   ├── prefixes.ts
│   │   ├── generate-id.ts
│   │   └── parse-id.ts
│   ├── schema/
│   │   ├── helpers.ts
│   │   ├── tables.ts
│   │   ├── zod.ts
│   │   └── relations.ts
│   ├── schema-engine/
│   │   ├── engine.ts
│   │   ├── preview.ts
│   │   ├── add-field.ts
│   │   ├── add-entity.ts
│   │   ├── promote-field.ts
│   │   ├── rls.ts
│   │   └── typegen.ts
│   ├── services/
│   │   ├── entity-service.ts
│   │   ├── search-service.ts
│   │   ├── audit-service.ts
│   │   └── contact-context.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── entities.ts
│   │   ├── errors.ts
│   │   ├── pagination.ts
│   │   └── schema.ts
│   ├── utils/
│   │   ├── cursor.ts
│   │   ├── dates.ts
│   │   └── json.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

Export surface:

```typescript
export * from './adapters/interface'
export * from './ids/generate-id'
export * from './ids/parse-id'
export * from './schema/tables'
export * from './schema/zod'
export * from './schema-engine/engine'
export * from './services/contact-context'
export * from './types/api'
export * from './types/entities'
export * from './types/errors'
export * from './types/pagination'
export * from './types/schema'
```

## 3. ID System

Orbit uses prefixed ULIDs everywhere. IDs are stored in `text` columns, never `uuid`.

Rules:

- Every persisted entity ID is `prefix + "_" + ulid()`
- Prefix identifies the object type at a glance
- Sort order is preserved because the ULID portion is lexicographically sortable
- API, SDK, CLI, and MCP must reject IDs with valid ULID bodies but wrong prefixes

```typescript
// packages/core/src/ids/prefixes.ts
export const ID_PREFIXES = {
  organization: 'org',
  membership: 'mbr',
  user: 'user',
  apiKey: 'key',
  contact: 'contact',
  company: 'company',
  deal: 'deal',
  pipeline: 'pipeline',
  stage: 'stage',
  activity: 'activity',
  task: 'task',
  note: 'note',
  product: 'product',
  payment: 'payment',
  contract: 'contract',
  sequence: 'sequence',
  sequenceStep: 'seqstep',
  sequenceEnrollment: 'seqenr',
  sequenceEvent: 'seqevt',
  tag: 'tag',
  entityTag: 'etag',
  customField: 'field',
  webhook: 'webhook',
  webhookDelivery: 'whdel',
  importJob: 'import',
  migration: 'migration',
  auditLog: 'audit',
  idempotencyKey: 'idem',
} as const

export type OrbitIdKind = keyof typeof ID_PREFIXES
```

```typescript
// packages/core/src/ids/generate-id.ts
import { ulid } from 'ulid'
import { ID_PREFIXES, type OrbitIdKind } from './prefixes'

export function generateId(kind: OrbitIdKind): string {
  return `${ID_PREFIXES[kind]}_${ulid()}`
}
```

```typescript
// packages/core/src/ids/parse-id.ts
import { ID_PREFIXES, type OrbitIdKind } from './prefixes'

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function assertOrbitId(value: string, kind: OrbitIdKind): string {
  const prefix = `${ID_PREFIXES[kind]}_`
  if (!value.startsWith(prefix)) {
    throw new Error(`Expected ${kind} ID with prefix "${prefix}"`)
  }
  const raw = value.slice(prefix.length)
  if (!ULID_PATTERN.test(raw)) {
    throw new Error(`Invalid ULID body for ${kind} ID`)
  }
  return value
}
```

## 4. Shared Types Module

`@orbit-ai/core/types` is the only allowed source for envelopes, errors, cursors, and cross-package entity names.

### 4.1 Error Codes

```typescript
// packages/core/src/types/errors.ts
export const ORBIT_ERROR_CODES = [
  'AUTH_INVALID_API_KEY',
  'AUTH_INSUFFICIENT_SCOPE',
  'AUTH_CONTEXT_REQUIRED',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'INVALID_CURSOR',
  'RESOURCE_NOT_FOUND',
  'RELATION_NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'SCHEMA_INVALID_FIELD',
  'SCHEMA_ENTITY_EXISTS',
  'SCHEMA_DESTRUCTIVE_BLOCKED',
  'SCHEMA_INCOMPATIBLE_PROMOTION',
  'MIGRATION_FAILED',
  'ADAPTER_UNAVAILABLE',
  'ADAPTER_TRANSACTION_FAILED',
  'RLS_GENERATION_FAILED',
  'WEBHOOK_DELIVERY_FAILED',
  'INTERNAL_ERROR',
] as const

export type OrbitErrorCode = (typeof ORBIT_ERROR_CODES)[number]

export interface OrbitErrorShape {
  code: OrbitErrorCode
  message: string
  field?: string
  request_id?: string
  doc_url?: string
  hint?: string
  recovery?: string
  retryable?: boolean
  details?: Record<string, unknown>
}
```

### 4.2 Pagination and Envelopes

```typescript
// packages/core/src/types/pagination.ts
export interface CursorPage {
  limit?: number
  cursor?: string
}

export interface PageMeta {
  request_id: string
  cursor: string | null
  next_cursor: string | null
  has_more: boolean
  version: string
}

export interface EnvelopeLinks {
  self: string
  next?: string
}

export interface OrbitEnvelope<T> {
  data: T
  meta: PageMeta
  links: EnvelopeLinks
}

export interface InternalPaginatedResult<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export function toWirePageMeta(input: {
  requestId: string
  version: string
  page: InternalPaginatedResult<unknown>
}): PageMeta {
  return {
    request_id: input.requestId,
    cursor: null,
    next_cursor: input.page.nextCursor,
    has_more: input.page.hasMore,
    version: input.version,
  }
}
```

```typescript
// packages/core/src/types/entities.ts
export type OrbitObjectType =
  | 'organizations'
  | 'organization_memberships'
  | 'users'
  | 'api_keys'
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'pipelines'
  | 'stages'
  | 'activities'
  | 'tasks'
  | 'notes'
  | 'products'
  | 'payments'
  | 'contracts'
  | 'sequences'
  | 'sequence_steps'
  | 'sequence_enrollments'
  | 'sequence_events'
  | 'tags'
  | 'entity_tags'
  | 'custom_field_definitions'
  | 'webhooks'
  | 'webhook_deliveries'
  | 'imports'
  | 'schema_migrations'
  | 'audit_logs'
  | 'idempotency_keys'
```

### 4.3 Search, Filters, and Sorting

```typescript
// packages/core/src/types/api.ts
export type SortDirection = 'asc' | 'desc'

export interface SortSpec {
  field: string
  direction: SortDirection
}

export interface ListQuery {
  limit?: number
  cursor?: string
  include?: string[]
  sort?: SortSpec[]
  filter?: Record<string, unknown>
}

export interface SearchQuery extends ListQuery {
  query?: string
}
```

Serialization rule:

- internal service, adapter, and repository types may use camelCase
- HTTP, MCP, CLI JSON, and persisted webhook payloads use snake_case
- `@orbit-ai/core` owns the required mapper helpers between internal page results and wire envelopes so downstream packages never hand-roll them

## 5. Drizzle Schema Definitions

All first-party tables live in schema `orbit`.

Tenant-scoped tables include:

- `id text primary key`
- `organization_id text not null references orbit.organizations(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Bootstrap and platform tables may omit `organization_id`. In v1, `organizations` is the only bootstrap table and is intentionally not tenant-scoped. All other first-party and plugin extension tables that hold tenant data must include `organization_id`.

### 5.1 Shared Column Helpers

```typescript
// packages/core/src/schema/helpers.ts
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const orbit = pgSchema('orbit')

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const customFieldsColumn = jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({})

export const money = (name: string) => numeric(name, { precision: 18, scale: 2 })
export const metadata = () => jsonb('metadata').$type<Record<string, unknown>>().notNull().default({})

export { boolean, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex }
```

### 5.2 Exact Table Definitions

```typescript
// packages/core/src/schema/tables.ts
import { sql } from 'drizzle-orm'
import {
  boolean,
  customFieldsColumn,
  foreignKey,
  index,
  integer,
  jsonb,
  metadata,
  money,
  orbit,
  primaryKey,
  text,
  timestamps,
  uniqueIndex,
} from './helpers'

export const organizations = orbit.table(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').notNull().default('community'),
    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [uniqueIndex('organizations_slug_idx').on(table.slug)],
)

export const users = orbit.table(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull().default('viewer'),
    avatarUrl: text('avatar_url'),
    externalAuthId: text('external_auth_id'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: metadata(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_org_email_idx').on(table.organizationId, table.email),
    index('users_external_auth_idx').on(table.externalAuthId),
  ],
)

export const organizationMemberships = orbit.table(
  'organization_memberships',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    userId: text('user_id').notNull().references(() => users.id),
    role: text('role').notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId),
  ],
)

export const apiKeys = orbit.table(
  'api_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('api_keys_hash_idx').on(table.keyHash),
    uniqueIndex('api_keys_prefix_idx').on(table.keyPrefix),
  ],
)

export const companies = orbit.table(
  'companies',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    domain: text('domain'),
    industry: text('industry'),
    size: integer('size'),
    website: text('website'),
    notes: text('notes'),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('companies_org_domain_idx').on(table.organizationId, table.domain),
    index('companies_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const contacts = orbit.table(
  'contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    sourceChannel: text('source_channel'),
    status: text('status').notNull().default('lead'),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    companyId: text('company_id').references(() => companies.id),
    leadScore: integer('lead_score').notNull().default(0),
    isHot: boolean('is_hot').notNull().default(false),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('contacts_org_email_idx').on(table.organizationId, table.email),
    index('contacts_company_idx').on(table.companyId),
    index('contacts_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const pipelines = orbit.table(
  'pipelines',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    description: text('description'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('pipelines_org_name_idx').on(table.organizationId, table.name),
  ],
)

export const stages = orbit.table(
  'stages',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    pipelineId: text('pipeline_id').notNull().references(() => pipelines.id),
    name: text('name').notNull(),
    stageOrder: integer('stage_order').notNull(),
    probability: integer('probability').notNull().default(0),
    color: text('color'),
    isWon: boolean('is_won').notNull().default(false),
    isLost: boolean('is_lost').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('stages_pipeline_order_idx').on(table.pipelineId, table.stageOrder),
    uniqueIndex('stages_pipeline_name_idx').on(table.pipelineId, table.name),
  ],
)

export const deals = orbit.table(
  'deals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    value: money('value'),
    currency: text('currency').notNull().default('USD'),
    stageId: text('stage_id').references(() => stages.id),
    pipelineId: text('pipeline_id').references(() => pipelines.id),
    probability: integer('probability').notNull().default(0),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    contactId: text('contact_id').references(() => contacts.id),
    companyId: text('company_id').references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    status: text('status').notNull().default('open'),
    wonAt: timestamp('won_at', { withTimezone: true }),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    lostReason: text('lost_reason'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('deals_stage_idx').on(table.stageId),
    index('deals_pipeline_idx').on(table.pipelineId),
    index('deals_contact_idx').on(table.contactId),
    index('deals_company_idx').on(table.companyId),
  ],
)

export const activities = orbit.table(
  'activities',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    type: text('type').notNull(),
    subject: text('subject'),
    body: text('body'),
    direction: text('direction').notNull().default('internal'),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    durationMinutes: integer('duration_minutes'),
    outcome: text('outcome'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    loggedByUserId: text('logged_by_user_id').references(() => users.id),
    metadata: metadata(),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('activities_contact_idx').on(table.contactId),
    index('activities_deal_idx').on(table.dealId),
    index('activities_company_idx').on(table.companyId),
    index('activities_occurred_at_idx').on(table.occurredAt),
  ],
)

export const tasks = orbit.table(
  'tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    priority: text('priority').notNull().default('medium'),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('tasks_due_date_idx').on(table.dueDate),
    index('tasks_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const notes = orbit.table(
  'notes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    content: text('content').notNull(),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('notes_contact_idx').on(table.contactId),
    index('notes_deal_idx').on(table.dealId),
  ],
)

export const products = orbit.table(
  'products',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    price: money('price').notNull(),
    currency: text('currency').notNull().default('USD'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('products_sort_order_idx').on(table.sortOrder),
  ],
)

export const payments = orbit.table(
  'payments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    amount: money('amount').notNull(),
    currency: text('currency').notNull().default('USD'),
    status: text('status').notNull(),
    method: text('method'),
    dealId: text('deal_id').references(() => deals.id),
    contactId: text('contact_id').references(() => contacts.id),
    externalId: text('external_id'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    metadata: metadata(),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('payments_external_id_idx').on(table.organizationId, table.externalId),
    index('payments_status_idx').on(table.status),
  ],
)

export const contracts = orbit.table(
  'contracts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    content: text('content'),
    status: text('status').notNull().default('draft'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    dealId: text('deal_id').references(() => deals.id),
    contactId: text('contact_id').references(() => contacts.id),
    companyId: text('company_id').references(() => companies.id),
    externalSignatureId: text('external_signature_id'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('contracts_status_idx').on(table.status),
  ],
)

export const sequences = orbit.table(
  'sequences',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    description: text('description'),
    triggerEvent: text('trigger_event'),
    status: text('status').notNull().default('draft'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('sequences_org_name_idx').on(table.organizationId, table.name),
  ],
)

export const sequenceSteps = orbit.table(
  'sequence_steps',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    sequenceId: text('sequence_id').notNull().references(() => sequences.id),
    stepOrder: integer('step_order').notNull(),
    actionType: text('action_type').notNull(),
    delayMinutes: integer('delay_minutes').notNull().default(0),
    templateSubject: text('template_subject'),
    templateBody: text('template_body'),
    taskTitle: text('task_title'),
    taskDescription: text('task_description'),
    metadata: metadata(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('sequence_steps_order_idx').on(table.sequenceId, table.stepOrder),
  ],
)

export const sequenceEnrollments = orbit.table(
  'sequence_enrollments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    sequenceId: text('sequence_id').notNull().references(() => sequences.id),
    contactId: text('contact_id').notNull().references(() => contacts.id),
    status: text('status').notNull().default('active'),
    currentStepOrder: integer('current_step_order').notNull().default(0),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    exitedAt: timestamp('exited_at', { withTimezone: true }),
    exitReason: text('exit_reason'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('sequence_enrollments_active_idx').on(table.sequenceId, table.contactId, table.status),
  ],
)

export const sequenceEvents = orbit.table(
  'sequence_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    sequenceEnrollmentId: text('sequence_enrollment_id').notNull().references(() => sequenceEnrollments.id),
    sequenceStepId: text('sequence_step_id').references(() => sequenceSteps.id),
    eventType: text('event_type').notNull(),
    payload: metadata(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    index('sequence_events_enrollment_idx').on(table.sequenceEnrollmentId),
  ],
)

export const tags = orbit.table(
  'tags',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    color: text('color'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('tags_org_name_idx').on(table.organizationId, table.name),
  ],
)

export const entityTags = orbit.table(
  'entity_tags',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    tagId: text('tag_id').notNull().references(() => tags.id),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('entity_tags_unique_idx').on(table.organizationId, table.tagId, table.entityType, table.entityId),
    index('entity_tags_lookup_idx').on(table.organizationId, table.entityType, table.entityId),
  ],
)

export const customFieldDefinitions = orbit.table(
  'custom_field_definitions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    entityType: text('entity_type').notNull(),
    fieldName: text('field_name').notNull(),
    fieldType: text('field_type').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    isRequired: boolean('is_required').notNull().default(false),
    isIndexed: boolean('is_indexed').notNull().default(false),
    isPromoted: boolean('is_promoted').notNull().default(false),
    promotedColumnName: text('promoted_column_name'),
    defaultValue: jsonb('default_value').$type<unknown>(),
    options: jsonb('options').$type<string[]>().notNull().default([]),
    validation: jsonb('validation').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('custom_fields_unique_idx').on(table.organizationId, table.entityType, table.fieldName),
  ],
)

export const webhooks = orbit.table(
  'webhooks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    url: text('url').notNull(),
    description: text('description'),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    secretEncrypted: text('secret_encrypted').notNull(),
    status: text('status').notNull().default('active'),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('webhooks_status_idx').on(table.status),
  ],
)

export const webhookDeliveries = orbit.table(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    webhookId: text('webhook_id').notNull().references(() => webhooks.id),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: metadata(),
    signature: text('signature').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('webhook_deliveries_event_idx').on(table.webhookId, table.eventId),
    index('webhook_deliveries_next_attempt_idx').on(table.nextAttemptAt),
  ],
)

export const imports = orbit.table(
  'imports',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    entityType: text('entity_type').notNull(),
    fileName: text('file_name').notNull(),
    totalRows: integer('total_rows').notNull().default(0),
    createdRows: integer('created_rows').notNull().default(0),
    updatedRows: integer('updated_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    status: text('status').notNull().default('pending'),
    rollbackData: jsonb('rollback_data').$type<Record<string, unknown>>().notNull().default({}),
    startedByUserId: text('started_by_user_id').references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('imports_entity_idx').on(table.entityType),
  ],
)

export const schemaMigrations = orbit.table(
  'schema_migrations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    description: text('description').notNull(),
    entityType: text('entity_type'),
    operationType: text('operation_type').notNull(),
    sqlStatements: jsonb('sql_statements').$type<string[]>().notNull().default([]),
    rollbackStatements: jsonb('rollback_statements').$type<string[]>().notNull().default([]),
    appliedByUserId: text('applied_by_user_id').references(() => users.id),
    approvedByUserId: text('approved_by_user_id').references(() => users.id),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('schema_migrations_applied_at_idx').on(table.appliedAt),
  ],
)

export const auditLogs = orbit.table(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    actorUserId: text('actor_user_id').references(() => users.id),
    actorApiKeyId: text('actor_api_key_id').references(() => apiKeys.id),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    requestId: text('request_id'),
    metadata: metadata(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.organizationId, table.entityType, table.entityId),
    index('audit_logs_occurred_at_idx').on(table.occurredAt),
  ],
)

export const idempotencyKeys = orbit.table(
  'idempotency_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    requestHash: text('request_hash').notNull(),
    responseCode: integer('response_code'),
    responseBody: jsonb('response_body').$type<unknown>(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idempotency_unique_idx').on(table.organizationId, table.key, table.method, table.path),
  ],
)
```

Notes:

- `entity_tags` is the required polymorphic tag join table
- `users` is core-owned; adapters may sync from external auth systems but the table remains canonical for Orbit joins
- `webhook_deliveries` belongs in core because retries and signatures must stay consistent across API and integrations

## 6. Zod Validation

Every base table gets generated Zod schemas from `drizzle-zod`, then extended with runtime custom field definitions.

```typescript
// packages/core/src/schema/zod.ts
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
  activities,
  companies,
  contacts,
  deals,
  products,
  tasks,
} from './tables'

export const contactSelectSchema = createSelectSchema(contacts)
export const contactInsertSchema = createInsertSchema(contacts, {
  email: z.string().email().optional().nullable(),
  phone: z.string().min(5).optional().nullable(),
})
export const contactUpdateSchema = createUpdateSchema(contacts)

export const companySelectSchema = createSelectSchema(companies)
export const dealSelectSchema = createSelectSchema(deals)
export const activityInsertSchema = createInsertSchema(activities)
export const taskInsertSchema = createInsertSchema(tasks)
export const productInsertSchema = createInsertSchema(products)
```

Validation rules:

- IDs: parse with `assertOrbitId`
- Currency codes: three-character uppercase ISO 4217 strings
- `stage.isWon` and `stage.isLost` cannot both be `true`
- `deals.wonAt` requires stage or status that resolves to won
- `custom_fields` keys must match `custom_field_definitions`
- promoted custom fields must not be duplicated under `custom_fields`

## 7. Custom Fields System

Custom fields are JSONB-backed first, promoted later only when needed.

Rules:

- Each extensible entity keeps `custom_fields jsonb not null default '{}'`
- Schema metadata lives in `custom_field_definitions`
- Reads always merge promoted columns and JSONB-backed fields into one logical SDK shape
- Writes reject unknown custom fields unless `allowUnknownCustomFields` is explicitly enabled for import flows

```typescript
// packages/core/src/types/schema.ts
export type CustomFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'relation'

export interface CustomFieldDefinition {
  id: string
  organizationId: string
  entityType: string
  fieldName: string
  fieldType: CustomFieldType
  label: string
  description?: string
  isRequired: boolean
  isIndexed: boolean
  isPromoted: boolean
  promotedColumnName?: string
  defaultValue?: unknown
  options: string[]
  validation: Record<string, unknown>
}
```

```typescript
// packages/core/src/schema-engine/add-field.ts
import { and, eq } from 'drizzle-orm'
import { generateId } from '../ids/generate-id'
import { customFieldDefinitions } from '../schema/tables'
import type { CustomFieldDefinition } from '../types/schema'
import type { OrbitDatabase } from '../adapters/interface'

export async function addCustomField(
  db: OrbitDatabase,
  input: Omit<CustomFieldDefinition, 'id'>,
): Promise<CustomFieldDefinition> {
  const existing = await db.query.customFieldDefinitions.findFirst({
    where: and(
      eq(customFieldDefinitions.organizationId, input.organizationId),
      eq(customFieldDefinitions.entityType, input.entityType),
      eq(customFieldDefinitions.fieldName, input.fieldName),
    ),
  })

  if (existing) {
    throw new Error(`Custom field "${input.entityType}.${input.fieldName}" already exists`)
  }

  const row: CustomFieldDefinition = {
    id: generateId('customField'),
    ...input,
  }

  await db.insert(customFieldDefinitions).values(row)
  return row
}
```

Promotion rules:

- `promoteField` creates a real column with the same logical name when supported
- SQLite promotion may recreate the table; `orbit doctor` must warn about this
- field drops and renames are destructive and blocked unless explicit approval exists

## 8. Storage Adapter Interface

The adapter layer is what allows one service layer to run on Supabase, Neon, raw Postgres, or SQLite.

```typescript
// packages/core/src/adapters/interface.ts
import type { SQL, InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { customFieldDefinitions } from '../schema/tables'

export type OrbitDatabase = PgDatabase<Record<string, never>> | BetterSQLite3Database<Record<string, never>>

export interface OrbitAuthContext {
  userId?: string
  orgId: string
  apiKeyId?: string
  requestId?: string
}

export interface IUserResolver {
  resolveByExternalAuthId(externalAuthId: string, orgId: string): Promise<string | null>
  upsertFromAuth(input: {
    orgId: string
    externalAuthId: string
    email: string
    name: string
    avatarUrl?: string
  }): Promise<string>
}

export interface StorageAdapter {
  readonly name: 'supabase' | 'neon' | 'postgres' | 'sqlite'
  readonly dialect: 'postgres' | 'sqlite'
  readonly supportsRls: boolean
  readonly supportsBranching: boolean
  readonly supportsJsonbIndexes: boolean
  readonly database: OrbitDatabase
  readonly users: IUserResolver

  connect(): Promise<void>
  disconnect(): Promise<void>
  migrate(): Promise<void>
  transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T>
  execute(statement: SQL): Promise<unknown>
  withTenantContext<T>(
    context: OrbitAuthContext,
    fn: (db: OrbitDatabase) => Promise<T>,
  ): Promise<T>
  createBranch?(name: string): Promise<{ id: string; name: string }>
  mergeBranch?(id: string): Promise<void>
  getSchemaSnapshot(): Promise<{
    customFields: InferSelectModel<typeof customFieldDefinitions>[]
    tables: string[]
  }>
}
```

Adapter-specific requirements:

- Supabase: uses Postgres RLS and may sync `users` from `auth.users`
- Neon: same as raw Postgres plus `createBranch` and `mergeBranch`
- Raw Postgres: full SQL support, no Supabase auth assumptions
- SQLite: application-level tenant enforcement, no database RLS, schema changes may require table recreation

```typescript
// packages/core/src/adapters/postgres/tenant-context.ts
export async function withTenantContext<T>(
  db: OrbitDatabase,
  context: OrbitAuthContext,
  fn: (tx: OrbitDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_org_id', ${context.orgId}, true)`)
    try {
      return await fn(tx)
    } finally {
      await tx.execute(sql`select set_config('app.current_org_id', '', true)`)
    }
  })
}
```

Postgres-family adapters must implement `withTenantContext()` with a transaction and `SET LOCAL`/transaction-local config semantics. SQLite adapters may no-op the session setting but must still route through `withTenantContext()` so the calling contract stays uniform.

### 8.1 Plugin Schema Extensions

`@orbit-ai/core` owns the extension contract used by `@orbit-ai/integrations`.

```typescript
export interface PluginSchemaExtension {
  key: string
  tables: string[]
  tenantScopedTables: string[]
  migrations: Array<{
    id: string
    up: string[]
    down: string[]
  }>
  registerObjectTypes?: string[]
}

export interface PluginSchemaRegistry {
  register(extension: PluginSchemaExtension): void
  list(): PluginSchemaExtension[]
}
```

Rules:

- plugin tables that hold tenant data must appear in `tenantScopedTables`
- plugin migrations run through the same schema engine recordkeeping as first-party migrations
- plugin tenant tables receive the same RLS generation and application-level tenant filtering as first-party tables

## 9. RLS Auto-Generation

RLS is generated for every tenant table on Postgres-family adapters. SQLite skips policy DDL and enforces org filters in repositories.

```typescript
// packages/core/src/schema-engine/rls.ts
const TENANT_TABLES = [
  'users',
  'organization_memberships',
  'api_keys',
  'contacts',
  'companies',
  'deals',
  'pipelines',
  'stages',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  'sequence_events',
  'tags',
  'entity_tags',
  'custom_field_definitions',
  'webhooks',
  'webhook_deliveries',
  'imports',
  'schema_migrations',
  'audit_logs',
  'idempotency_keys',
] as const

export function generatePostgresRlsSql(schema = 'orbit'): string[] {
  const statements = [
    `create or replace function ${schema}.current_org_id() returns text language sql stable as $$ select current_setting('app.current_org_id', true) $$;`,
  ]

  for (const table of TENANT_TABLES) {
    statements.push(
      `alter table ${schema}.${table} enable row level security;`,
      `create policy ${table}_select on ${schema}.${table} for select using (organization_id = ${schema}.current_org_id());`,
      `create policy ${table}_insert on ${schema}.${table} for insert with check (organization_id = ${schema}.current_org_id());`,
      `create policy ${table}_update on ${schema}.${table} for update using (organization_id = ${schema}.current_org_id()) with check (organization_id = ${schema}.current_org_id());`,
      `create policy ${table}_delete on ${schema}.${table} for delete using (organization_id = ${schema}.current_org_id());`,
    )
  }

  return statements
}
```

Tenant context rules:

- `organizations` is intentionally excluded because it is a bootstrap/platform table, not a tenant table
- API and SDK direct-DB mode must execute tenant-scoped work inside `adapter.withTenantContext(...)`
- `organization_id` must always be injected by the service layer, never trusted from public callers
- repositories still include explicit `where organization_id = ctx.orgId` filters even when RLS is enabled

## 10. Schema Engine

The schema engine is the moat and must remain non-destructive by default.

```typescript
// packages/core/src/schema-engine/engine.ts
import type { StorageAdapter } from '../adapters/interface'
import type { CustomFieldDefinition } from '../types/schema'

export interface SchemaOperationResult {
  migrationId: string
  sql: string[]
  rollbackSql: string[]
  warnings: string[]
}

export interface SchemaEngine {
  addField(input: Omit<CustomFieldDefinition, 'id'>): Promise<SchemaOperationResult>
  addEntity(input: {
    organizationId: string
    name: string
    label: string
    fields: Array<{ name: string; type: string; nullable?: boolean }>
  }): Promise<SchemaOperationResult>
  promoteField(input: {
    organizationId: string
    entityType: string
    fieldName: string
  }): Promise<SchemaOperationResult>
  preview(input: { organizationId: string; operations: unknown[] }): Promise<SchemaOperationResult>
  apply(migrationId: string): Promise<void>
  rollback(migrationId: string): Promise<void>
  describe(organizationId: string, entityType?: string): Promise<Record<string, unknown>>
}

export class OrbitSchemaEngine implements SchemaEngine {
  constructor(private readonly adapter: StorageAdapter) {}
  async addField(): Promise<SchemaOperationResult> {
    throw new Error('implemented in add-field.ts')
  }
  async addEntity(): Promise<SchemaOperationResult> {
    throw new Error('implemented in add-entity.ts')
  }
  async promoteField(): Promise<SchemaOperationResult> {
    throw new Error('implemented in promote-field.ts')
  }
  async preview(): Promise<SchemaOperationResult> {
    throw new Error('implemented in preview.ts')
  }
  async apply(): Promise<void> {
    throw new Error('implemented in apply.ts')
  }
  async rollback(): Promise<void> {
    throw new Error('implemented in rollback.ts')
  }
  async describe(): Promise<Record<string, unknown>> {
    throw new Error('implemented in describe.ts')
  }
}
```

Safety rules:

- `addField` is metadata-only unless `promoteImmediately` is explicitly requested
- `drop_field`, `drop_entity`, and type changes are blocked in production without approval
- Neon migrations must branch first
- migration records live in DB and `.orbit/migrations/*.json`

## 11. Entity Operations

Every entity service implements a common contract and injects `organization_id` automatically.

```typescript
// packages/core/src/services/entity-service.ts
import type { InternalPaginatedResult } from '../types/pagination'
import type { SearchQuery } from '../types/api'
import type { OrbitErrorShape } from '../types/errors'
import type { OrbitAuthContext } from '../adapters/interface'

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
```

```typescript
// packages/core/src/services/index.ts
import type { StorageAdapter } from '../adapters/interface'

export function createCoreServices(adapter: StorageAdapter) {
  return {
    contacts: createContactService(adapter),
    companies: createCompanyService(adapter),
    deals: createDealService(adapter),
    pipelines: createPipelineService(adapter),
    stages: createStageService(adapter),
    activities: createActivityService(adapter),
    tasks: createTaskService(adapter),
    notes: createNoteService(adapter),
    products: createProductService(adapter),
    payments: createPaymentService(adapter),
    contracts: createContractService(adapter),
    sequences: createSequenceService(adapter),
    sequenceSteps: createSequenceStepService(adapter),
    sequenceEnrollments: createSequenceEnrollmentService(adapter),
    sequenceEvents: createSequenceEventService(adapter),
    tags: createTagService(adapter),
    webhooks: createWebhookService(adapter),
    imports: createImportService(adapter),
    users: createUserService(adapter),
    search: createSearchService(adapter),
    schema: new OrbitSchemaEngine(adapter),
    contactContext: createContactContextService(adapter),
    system: {
      organizations: createOrganizationAdminService(adapter),
      organizationMemberships: createOrganizationMembershipAdminService(adapter),
      apiKeys: createApiKeyAdminService(adapter),
      auditLogs: createAuditLogAdminService(adapter),
      schemaMigrations: createSchemaMigrationAdminService(adapter),
      idempotencyKeys: createIdempotencyKeyAdminService(adapter),
      webhookDeliveries: createWebhookDeliveryAdminService(adapter),
      customFieldDefinitions: createCustomFieldAdminService(adapter),
      entityTags: createEntityTagAdminService(adapter),
    },
  }
}
```

Required first-party services:

- `contacts`
- `companies`
- `deals`
- `pipelines`
- `stages`
- `activities`
- `tasks`
- `notes`
- `products`
- `payments`
- `contracts`
- `sequences`
- `sequence_steps`
- `sequence_enrollments`
- `sequence_events`
- `tags`
- `webhooks`
- `imports`
- `schema`
- `users`

System/admin services:

- `organizations`
- `organization_memberships`
- `api_keys`
- `custom_field_definitions`
- `webhook_deliveries`
- `audit_logs`
- `schema_migrations`
- `idempotency_keys`
- `entity_tags`

Every service must:

- validate input through Zod
- enforce tenant scope
- write audit logs on mutation
- support cursor pagination
- respect idempotency for create/update/delete entry points

## 12. Audit Logging

Every mutation writes an `audit_logs` row with before/after JSON.

```typescript
// packages/core/src/services/audit-service.ts
import { generateId } from '../ids/generate-id'
import { auditLogs } from '../schema/tables'
import type { OrbitDatabase, OrbitAuthContext } from '../adapters/interface'

export async function writeAuditLog(
  db: OrbitDatabase,
  ctx: OrbitAuthContext,
  input: {
    entityType: string
    entityId: string
    action: 'create' | 'update' | 'delete' | 'move' | 'assign'
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    id: generateId('auditLog'),
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    actorApiKeyId: ctx.apiKeyId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: ctx.requestId,
    occurredAt: new Date(),
  })
}
```

## 13. `getContactContext()`

This query is shared by CLI `orbit context`, MCP assistants, and future workflow automation.

```typescript
// packages/core/src/services/contact-context.ts
export interface ContactContextResult {
  contact: Record<string, unknown>
  company: Record<string, unknown> | null
  openDeals: Record<string, unknown>[]
  openTasks: Record<string, unknown>[]
  recentActivities: Record<string, unknown>[]
  tags: Array<{ id: string; name: string; color: string | null }>
  lastContactDate: string | null
}

export interface ContactContextService {
  getContactContext(
    ctx: { orgId: string },
    input: { contactId?: string; email?: string },
  ): Promise<ContactContextResult | null>
}
```

The implementation must return:

- contact record
- associated company
- last 10 activities sorted by `occurred_at desc`
- all open tasks sorted by due date
- all open deals sorted by `updated_at desc`
- applied tags
- derived `lastContactDate` as max of activity occurred date and contact last contacted date

## 14. AGENTS.MD and Generated Artifacts

`@orbit-ai/core` must generate machine-readable docs for each entity into:

```text
packages/core/src/entities/<entity>/AGENTS.MD
```

Each file must include:

- field list and types
- required relationships
- common filters and sorts
- examples of create/update payloads
- schema-safe extension notes for agents

Generated files after schema change:

- `src/generated/<entity>.zod.ts`
- `src/generated/<entity>.types.ts`
- `.orbit/migrations/<timestamp>_<operation>.json`
- updated `AGENTS.MD` snippets if a custom field is added

## 15. Acceptance Criteria

Implementation is complete only when all of the following are true:

1. `pnpm --filter @orbit-ai/core build` succeeds with no generated-type drift.
2. Base migrations create every tenant-scoped table in this spec with `organization_id text not null`, while `organizations` remains bootstrap-scoped.
3. Postgres adapters generate and apply RLS SQL for every tenant table.
4. Tenant context is applied through `withTenantContext()` and is safe under pooled Postgres connections.
5. SQLite adapter enforces tenant filters in repositories and documents migration limitations.
6. `addField`, `addEntity`, and `promoteField` produce reversible migration records.
7. Plugin schema extensions can register tenant tables and receive RLS coverage.
8. Cursor pagination and error/envelope types are imported unchanged by API, SDK, CLI, and MCP packages.
9. `getContactContext()` returns the exact dossier shape required by CLI and MCP.
10. Every entity directory contains `AGENTS.MD`.
