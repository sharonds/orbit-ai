# Core Wave 2 Slice E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four remaining Wave 2 system/admin metadata entities (`customFieldDefinitions`, `auditLogs`, `schemaMigrations`, `idempotencyKeys`), complete the Wave 2 service registry, and prove SQLite/Postgres persistence for the final metadata surface.

**Architecture:** Each entity follows the established admin-read-only pattern: Drizzle table definition, Zod validators with sanitization for sensitive fields, in-memory/SQLite/Postgres repositories, and an `AdminEntityService<T>` wired into `system.*`. Sensitive fields (`auditLogs.before/after`, `idempotencyKeys.requestHash/responseBody`) are redacted in the admin read DTO. The four entities are registered in tenant-scope, added to adapter bootstrap schemas, and exported from the package index.

**Tech Stack:** TypeScript (strict), Drizzle ORM, Zod, Vitest, pnpm monorepo

---

## File Structure

### New files to create

```
packages/core/src/entities/custom-field-definitions/
  validators.ts          — Zod record schema, sanitized DTO (pass-through, no redaction needed)
  repository.ts          — Interface + in-memory + SQLite + Postgres implementations
  service.ts             — createCustomFieldDefinitionAdminService
  service.test.ts        — Admin get/list, tenant isolation, uniqueness, field-type validation
  AGENTS.MD              — Entity-local agent guidance

packages/core/src/entities/audit-logs/
  validators.ts          — Zod record schema + sanitized DTO (redact before/after)
  repository.ts          — Interface + in-memory + SQLite + Postgres implementations
  service.ts             — createAuditLogAdminService (returns sanitized records)
  service.test.ts        — Admin get/list, tenant isolation, actor resolution, sanitization
  AGENTS.MD              — Entity-local agent guidance

packages/core/src/entities/schema-migrations/
  validators.ts          — Zod record schema (no redaction needed — SQL statements are operational)
  repository.ts          — Interface + in-memory + SQLite + Postgres implementations
  service.ts             — createSchemaMigrationAdminService
  service.test.ts        — Admin get/list, tenant isolation, actor resolution, JSON array persistence
  AGENTS.MD              — Entity-local agent guidance

packages/core/src/entities/idempotency-keys/
  validators.ts          — Zod record schema + sanitized DTO (redact requestHash/responseBody)
  repository.ts          — Interface + in-memory + SQLite + Postgres implementations
  service.ts             — createIdempotencyKeyAdminService (returns sanitized records)
  service.test.ts        — Admin get/list, tenant isolation, uniqueness, sanitization
  AGENTS.MD              — Entity-local agent guidance
```

### Existing files to modify

```
packages/core/src/schema/tables.ts               — Add 4 new table definitions
packages/core/src/schema/relations.ts             — Add relations for Slice E tables
packages/core/src/schema/zod.ts                   — Add select/insert/update schemas for 4 tables
packages/core/src/repositories/tenant-scope.ts    — Register 4 new tenant tables
packages/core/src/services/index.ts               — Import repos/services, add overrides, wire system.*
packages/core/src/index.ts                        — Export new entity modules
packages/core/src/adapters/sqlite/schema.ts       — Add Slice E bootstrap statements + helper
packages/core/src/adapters/postgres/schema.ts     — Add Slice E bootstrap statements + helper
```

### Existing test files to modify

```
packages/core/src/services/index.test.ts               — Registry shape assertions for Slice E
packages/core/src/services/sqlite-persistence.test.ts   — SQLite persistence proofs for 4 entities
packages/core/src/services/postgres-persistence.test.ts — Postgres persistence proofs for 4 entities
```

---

## Workstream A: Metadata Schema Foundation (customFieldDefinitions + auditLogs)

### Task 1: Add Drizzle table definitions for customFieldDefinitions and auditLogs

**Files:**
- Modify: `packages/core/src/schema/tables.ts:468` (append after webhookDeliveries)

- [ ] **Step 1: Add the customFieldDefinitions table**

Add at the end of `packages/core/src/schema/tables.ts`:

```typescript
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
```

- [ ] **Step 2: Add the auditLogs table**

Continue appending to `packages/core/src/schema/tables.ts`:

```typescript
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
```

- [ ] **Step 3: Run typecheck to verify table definitions compile**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS — no type errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/schema/tables.ts
git commit -m "feat(core): add Drizzle table definitions for customFieldDefinitions and auditLogs"
```

---

### Task 2: Add Drizzle relations for customFieldDefinitions and auditLogs

**Files:**
- Modify: `packages/core/src/schema/relations.ts`

- [ ] **Step 1: Import all tables including Slice D and Slice E**

In `packages/core/src/schema/relations.ts`, replace the import block from `'./tables.js'` to include Slice D tables (which were missing from relations) and the new Slice E tables:

```typescript
import {
  activities,
  apiKeys,
  auditLogs,
  companies,
  contracts,
  contacts,
  customFieldDefinitions,
  deals,
  entityTags,
  imports,
  notes,
  organizationMemberships,
  organizations,
  payments,
  pipelines,
  products,
  sequenceEnrollments,
  sequenceEvents,
  sequences,
  sequenceSteps,
  stages,
  tags,
  tasks,
  users,
  webhookDeliveries,
  webhooks,
} from './tables.js'
```

Note: Slice D tables (`tags`, `entityTags`, `imports`, `webhooks`, `webhookDeliveries`) were missing from the relations file. This task adds them alongside the Slice E tables.

- [ ] **Step 2: Add organizationsRelations entries for Slice D and Slice E tables**

Update the existing `organizationsRelations` definition to include all missing Slice D and Slice E tables:

```typescript
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  memberships: many(organizationMemberships),
  apiKeys: many(apiKeys),
  companies: many(companies),
  contacts: many(contacts),
  pipelines: many(pipelines),
  stages: many(stages),
  deals: many(deals),
  activities: many(activities),
  tasks: many(tasks),
  notes: many(notes),
  products: many(products),
  payments: many(payments),
  contracts: many(contracts),
  sequences: many(sequences),
  sequenceSteps: many(sequenceSteps),
  sequenceEnrollments: many(sequenceEnrollments),
  sequenceEvents: many(sequenceEvents),
  tags: many(tags),
  entityTags: many(entityTags),
  imports: many(imports),
  webhooks: many(webhooks),
  webhookDeliveries: many(webhookDeliveries),
  customFieldDefinitions: many(customFieldDefinitions),
  auditLogs: many(auditLogs),
}))
```

- [ ] **Step 3: Add Slice D relations (tags, entityTags, imports, webhooks, webhookDeliveries)**

Append to `packages/core/src/schema/relations.ts`:

```typescript
export const tagsRelations = relations(tags, ({ one }) => ({
  organization: one(organizations, {
    fields: [tags.organizationId],
    references: [organizations.id],
  }),
}))

export const entityTagsRelations = relations(entityTags, ({ one }) => ({
  organization: one(organizations, {
    fields: [entityTags.organizationId],
    references: [organizations.id],
  }),
  tag: one(tags, {
    fields: [entityTags.tagId],
    references: [tags.id],
  }),
}))

export const importsRelations = relations(imports, ({ one }) => ({
  organization: one(organizations, {
    fields: [imports.organizationId],
    references: [organizations.id],
  }),
  startedBy: one(users, {
    fields: [imports.startedByUserId],
    references: [users.id],
  }),
}))

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
  deliveries: many(webhookDeliveries),
}))

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  organization: one(organizations, {
    fields: [webhookDeliveries.organizationId],
    references: [organizations.id],
  }),
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}))
```

- [ ] **Step 4: Add customFieldDefinitions relations**

Append to `packages/core/src/schema/relations.ts`:

```typescript
export const customFieldDefinitionsRelations = relations(customFieldDefinitions, ({ one }) => ({
  organization: one(organizations, {
    fields: [customFieldDefinitions.organizationId],
    references: [organizations.id],
  }),
}))
```

- [ ] **Step 5: Add auditLogs relations**

Append to `packages/core/src/schema/relations.ts`:

```typescript
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  actorUser: one(users, {
    relationName: 'auditLogActorUser',
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  actorApiKey: one(apiKeys, {
    relationName: 'auditLogActorApiKey',
    fields: [auditLogs.actorApiKeyId],
    references: [apiKeys.id],
  }),
}))
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schema/relations.ts
git commit -m "feat(core): add Drizzle relations for customFieldDefinitions and auditLogs"
```

---

### Task 3: Add Zod schemas for customFieldDefinitions and auditLogs

**Files:**
- Modify: `packages/core/src/schema/zod.ts`

- [ ] **Step 1: Import the new tables**

Add `customFieldDefinitions` and `auditLogs` to the import block from `'./tables.js'` in `packages/core/src/schema/zod.ts`:

```typescript
import {
  activities,
  apiKeys,
  auditLogs,
  companies,
  contracts,
  contacts,
  customFieldDefinitions,
  deals,
  entityTags,
  imports,
  notes,
  organizationMemberships,
  organizations,
  payments,
  pipelines,
  products,
  sequenceEnrollments,
  sequenceEvents,
  sequences,
  sequenceSteps,
  stages,
  tags,
  tasks,
  users,
  webhookDeliveries,
  webhooks,
} from './tables.js'
```

- [ ] **Step 2: Add customFieldDefinitions Zod schemas**

Append to `packages/core/src/schema/zod.ts`:

```typescript
// Custom Field Definitions
export const customFieldDefinitionSelectSchema = createSelectSchema(customFieldDefinitions, {
  id: orbitId('customField'),
  organizationId: orbitId('organization'),
})
export const customFieldDefinitionInsertSchema = createInsertSchema(customFieldDefinitions, {
  organizationId: orbitId('organization'),
})
export const customFieldDefinitionUpdateSchema = createUpdateSchema(customFieldDefinitions, {
  organizationId: orbitId('organization').optional(),
})
```

- [ ] **Step 3: Add auditLogs Zod schemas**

Append to `packages/core/src/schema/zod.ts`:

```typescript
// Audit Logs
export const auditLogSelectSchema = createSelectSchema(auditLogs, {
  id: orbitId('auditLog'),
  organizationId: orbitId('organization'),
  actorUserId: orbitId('user').optional().nullable(),
  actorApiKeyId: orbitId('apiKey').optional().nullable(),
})
export const auditLogInsertSchema = createInsertSchema(auditLogs, {
  organizationId: orbitId('organization'),
  actorUserId: orbitId('user').optional().nullable(),
  actorApiKeyId: orbitId('apiKey').optional().nullable(),
})
export const auditLogUpdateSchema = createUpdateSchema(auditLogs, {
  organizationId: orbitId('organization').optional(),
  actorUserId: orbitId('user').optional().nullable(),
  actorApiKeyId: orbitId('apiKey').optional().nullable(),
})
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema/zod.ts
git commit -m "feat(core): add Zod schemas for customFieldDefinitions and auditLogs"
```

---

### Task 4: Create customFieldDefinitions validators

**Files:**
- Create: `packages/core/src/entities/custom-field-definitions/validators.ts`

- [ ] **Step 1: Write the validators file**

Create `packages/core/src/entities/custom-field-definitions/validators.ts`:

```typescript
import { z } from 'zod'

import { customFieldDefinitionSelectSchema, customFieldDefinitionInsertSchema } from '../../schema/zod.js'

const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'currency',
  'relation',
] as const

const customFieldTypeSchema = z.enum(CUSTOM_FIELD_TYPES)

export const customFieldDefinitionRecordSchema = customFieldDefinitionSelectSchema.extend({
  fieldType: customFieldTypeSchema,
})
export type CustomFieldDefinitionRecord = z.infer<typeof customFieldDefinitionRecordSchema>

export const customFieldDefinitionCreateInputSchema = customFieldDefinitionInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  fieldType: customFieldTypeSchema,
})
export type CustomFieldDefinitionCreateInput = z.input<typeof customFieldDefinitionCreateInputSchema>
```

Note: `customFieldDefinitions` is metadata-only. Per the plan (section 6.2), it may return its canonical persisted shape directly — no sanitization/redaction needed.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 5: Create customFieldDefinitions repository

**Files:**
- Create: `packages/core/src/entities/custom-field-definitions/repository.ts`

- [ ] **Step 1: Write the repository file**

Create `packages/core/src/entities/custom-field-definitions/repository.ts`:

```typescript
import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresDate,
  fromPostgresJson,
} from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import {
  customFieldDefinitionRecordSchema,
  type CustomFieldDefinitionRecord,
} from './validators.js'

export interface CustomFieldDefinitionRepository {
  create(ctx: OrbitAuthContext, record: CustomFieldDefinitionRecord): Promise<CustomFieldDefinitionRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<CustomFieldDefinitionRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<CustomFieldDefinitionRecord>>
}

const SEARCHABLE_FIELDS = ['entity_type', 'field_name', 'label']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'entity_type',
  'field_name',
  'field_type',
  'is_required',
  'is_indexed',
  'is_promoted',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

export function createInMemoryCustomFieldDefinitionRepository(
  seed: CustomFieldDefinitionRecord[] = [],
): CustomFieldDefinitionRepository {
  const rows = new Map(seed.map((r) => [r.id, customFieldDefinitionRecordSchema.parse(r)]))

  function scopedRows(ctx: OrbitAuthContext): CustomFieldDefinitionRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((r) => r.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Custom field definition organization mismatch')
      }

      // Uniqueness: (organizationId, entityType, fieldName)
      for (const existing of rows.values()) {
        if (
          existing.organizationId === record.organizationId &&
          existing.entityType === record.entityType &&
          existing.fieldName === record.fieldName
        ) {
          throw createOrbitError({
            code: 'CONFLICT',
            message: `Custom field definition already exists for entity ${record.entityType}, field ${record.fieldName}`,
          })
        }
      }

      const parsed = customFieldDefinitionRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEARCHABLE_FIELDS,
        filterableFields: FILTERABLE_FIELDS,
        defaultSort: DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteCustomFieldDefinitionRepository(
  adapter: StorageAdapter,
): CustomFieldDefinitionRepository {
  const base = createTenantSqliteRepository<CustomFieldDefinitionRecord>(adapter, {
    tableName: 'custom_field_definitions',
    columns: [
      'id',
      'organization_id',
      'entity_type',
      'field_name',
      'field_type',
      'label',
      'description',
      'is_required',
      'is_indexed',
      'is_promoted',
      'promoted_column_name',
      'default_value',
      'options',
      'validation',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        entity_type: record.entityType,
        field_name: record.fieldName,
        field_type: record.fieldType,
        label: record.label,
        description: record.description ?? null,
        is_required: record.isRequired ? 1 : 0,
        is_indexed: record.isIndexed ? 1 : 0,
        is_promoted: record.isPromoted ? 1 : 0,
        promoted_column_name: record.promotedColumnName ?? null,
        default_value: record.defaultValue != null ? toSqliteJson(record.defaultValue) : null,
        options: toSqliteJson(record.options),
        validation: toSqliteJson(record.validation),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return customFieldDefinitionRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        fieldName: row.field_name,
        fieldType: row.field_type,
        label: row.label,
        description: row.description ?? null,
        isRequired: !!row.is_required,
        isIndexed: !!row.is_indexed,
        isPromoted: !!row.is_promoted,
        promotedColumnName: row.promoted_column_name ?? null,
        defaultValue: fromSqliteJson(row.default_value, null),
        options: fromSqliteJson(row.options, []),
        validation: fromSqliteJson(row.validation, {}),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Custom field definition organization mismatch')
      }
      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresCustomFieldDefinitionRepository(
  adapter: StorageAdapter,
): CustomFieldDefinitionRepository {
  const base = createTenantPostgresRepository<CustomFieldDefinitionRecord>(adapter, {
    tableName: 'custom_field_definitions',
    columns: [
      'id',
      'organization_id',
      'entity_type',
      'field_name',
      'field_type',
      'label',
      'description',
      'is_required',
      'is_indexed',
      'is_promoted',
      'promoted_column_name',
      'default_value',
      'options',
      'validation',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        entity_type: record.entityType,
        field_name: record.fieldName,
        field_type: record.fieldType,
        label: record.label,
        description: record.description ?? null,
        is_required: record.isRequired,
        is_indexed: record.isIndexed,
        is_promoted: record.isPromoted,
        promoted_column_name: record.promotedColumnName ?? null,
        default_value: record.defaultValue ?? null,
        options: record.options,
        validation: record.validation,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return customFieldDefinitionRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        fieldName: row.field_name,
        fieldType: row.field_type,
        label: row.label,
        description: row.description ?? null,
        isRequired: !!row.is_required,
        isIndexed: !!row.is_indexed,
        isPromoted: !!row.is_promoted,
        promotedColumnName: row.promoted_column_name ?? null,
        defaultValue: fromPostgresJson(row.default_value, null),
        options: fromPostgresJson(row.options, []),
        validation: fromPostgresJson(row.validation, {}),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Custom field definition organization mismatch')
      }
      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 6: Create customFieldDefinitions admin service

**Files:**
- Create: `packages/core/src/entities/custom-field-definitions/service.ts`

- [ ] **Step 1: Write the service file**

Create `packages/core/src/entities/custom-field-definitions/service.ts`:

```typescript
import type { AdminEntityService } from '../../services/entity-service.js'
import type { CustomFieldDefinitionRepository } from './repository.js'
import type { CustomFieldDefinitionRecord } from './validators.js'

export function createCustomFieldDefinitionAdminService(
  repository: CustomFieldDefinitionRepository,
): AdminEntityService<CustomFieldDefinitionRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
```

Note: No sanitization needed — `customFieldDefinitions` is metadata-only (plan section 6.2).

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 7: Write customFieldDefinitions tests

**Files:**
- Create: `packages/core/src/entities/custom-field-definitions/service.test.ts`

- [ ] **Step 1: Write the test file**

Create `packages/core/src/entities/custom-field-definitions/service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryCustomFieldDefinitionRepository } from './repository.js'
import { createCustomFieldDefinitionAdminService } from './service.js'
import type { CustomFieldDefinitionRecord } from './validators.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

function makeRecord(overrides: Partial<CustomFieldDefinitionRecord> = {}): CustomFieldDefinitionRecord {
  return {
    id: generateId('customField'),
    organizationId: ctx.orgId,
    entityType: 'contacts',
    fieldName: 'priority',
    fieldType: 'select',
    label: 'Priority',
    description: 'Contact priority level',
    isRequired: false,
    isIndexed: false,
    isPromoted: false,
    promotedColumnName: null,
    defaultValue: null,
    options: ['low', 'medium', 'high'],
    validation: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('custom field definition admin service', () => {
  it('lists custom field definitions within org scope', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repository)

    await repository.create(ctx, makeRecord())

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.entityType).toBe('contacts')
    expect(result.data[0]?.fieldType).toBe('select')
  })

  it('gets a single custom field definition by id', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
    expect(fetched?.fieldName).toBe('priority')
    expect(fetched?.options).toEqual(['low', 'medium', 'high'])
    expect(fetched?.validation).toEqual({})
  })

  it('tenant isolation: org B cannot see org A custom field definitions', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    expect(await service.get(ctxB, record.id)).toBeNull()
    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('rejects duplicate (organizationId, entityType, fieldName)', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()

    await repository.create(ctx, makeRecord())

    await expect(
      repository.create(ctx, makeRecord({ id: generateId('customField') })),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('allows same fieldName for different entityTypes', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()

    await repository.create(ctx, makeRecord({ entityType: 'contacts' }))

    const second = await repository.create(ctx, makeRecord({
      id: generateId('customField'),
      entityType: 'companies',
    }))

    expect(second.entityType).toBe('companies')
  })

  it('validates fieldType against the CustomFieldType union', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()

    await expect(
      repository.create(ctx, makeRecord({
        fieldType: 'invalid_type' as any,
      })),
    ).rejects.toThrow()
  })

  it('round-trips JSON metadata fields (options, validation, defaultValue)', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repository)

    const record = await repository.create(ctx, makeRecord({
      options: ['a', 'b', 'c'],
      validation: { minLength: 1, maxLength: 100 },
      defaultValue: 'a',
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.options).toEqual(['a', 'b', 'c'])
    expect(fetched?.validation).toEqual({ minLength: 1, maxLength: 100 })
    expect(fetched?.defaultValue).toBe('a')
  })

  it('preserves all canonical persisted fields', async () => {
    const repository = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repository)

    const record = await repository.create(ctx, makeRecord({
      isRequired: true,
      isIndexed: true,
      isPromoted: true,
      promotedColumnName: 'cf_priority',
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.isRequired).toBe(true)
    expect(fetched?.isIndexed).toBe(true)
    expect(fetched?.isPromoted).toBe(true)
    expect(fetched?.promotedColumnName).toBe('cf_priority')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @orbit-ai/core test -- --run packages/core/src/entities/custom-field-definitions/service.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/entities/custom-field-definitions/
git commit -m "feat(core): add customFieldDefinitions validators, repository, service, and tests"
```

---

### Task 8: Create auditLogs validators

**Files:**
- Create: `packages/core/src/entities/audit-logs/validators.ts`

- [ ] **Step 1: Write the validators file**

Create `packages/core/src/entities/audit-logs/validators.ts`:

```typescript
import { z } from 'zod'

import { auditLogSelectSchema, auditLogInsertSchema } from '../../schema/zod.js'

export const auditLogRecordSchema = auditLogSelectSchema
export type AuditLogRecord = z.infer<typeof auditLogRecordSchema>

export const sanitizedAuditLogRecordSchema = auditLogRecordSchema.omit({
  before: true,
  after: true,
})
export type SanitizedAuditLogRecord = z.infer<typeof sanitizedAuditLogRecordSchema>

export function sanitizeAuditLogRecord(record: AuditLogRecord): SanitizedAuditLogRecord {
  return sanitizedAuditLogRecordSchema.parse(record)
}

export const auditLogCreateInputSchema = auditLogInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type AuditLogCreateInput = z.input<typeof auditLogCreateInputSchema>
```

Note: `before` and `after` are redacted per plan section 6.2 — they may carry sensitive entity snapshots.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 9: Create auditLogs repository

**Files:**
- Create: `packages/core/src/entities/audit-logs/repository.ts`

- [ ] **Step 1: Write the repository file**

Create `packages/core/src/entities/audit-logs/repository.ts`:

```typescript
import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresDate,
  fromPostgresJson,
} from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { auditLogRecordSchema, type AuditLogRecord } from './validators.js'
import type { UserRepository } from '../users/repository.js'
import type { ApiKeyRepository } from '../api-keys/repository.js'

export interface AuditLogRepository {
  create(ctx: OrbitAuthContext, record: AuditLogRecord): Promise<AuditLogRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<AuditLogRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<AuditLogRecord>>
}

const SEARCHABLE_FIELDS = ['entity_type', 'entity_id', 'action']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'actor_user_id',
  'actor_api_key_id',
  'entity_type',
  'entity_id',
  'action',
  'request_id',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'occurred_at', direction: 'desc' },
]

async function assertActorUserInTenant(
  users: Pick<UserRepository, 'get'>,
  ctx: OrbitAuthContext,
  userId: string,
): Promise<void> {
  const user = await users.get(ctx, userId)
  if (!user) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Actor user ${userId} not found in this organization`,
    })
  }
}

async function assertActorApiKeyInTenant(
  apiKeys: Pick<ApiKeyRepository, 'get'>,
  ctx: OrbitAuthContext,
  apiKeyId: string,
): Promise<void> {
  const key = await apiKeys.get(ctx, apiKeyId)
  if (!key) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Actor API key ${apiKeyId} not found in this organization`,
    })
  }
}

export function createInMemoryAuditLogRepository(
  seed: AuditLogRecord[] = [],
  deps: {
    users?: Pick<UserRepository, 'get'>
    apiKeys?: Pick<ApiKeyRepository, 'get'>
  } = {},
): AuditLogRepository {
  const rows = new Map(seed.map((r) => [r.id, auditLogRecordSchema.parse(r)]))

  function scopedRows(ctx: OrbitAuthContext): AuditLogRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((r) => r.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Audit log organization mismatch')
      }

      if (record.actorUserId && deps.users) {
        await assertActorUserInTenant(deps.users, ctx, record.actorUserId)
      }
      if (record.actorApiKeyId && deps.apiKeys) {
        await assertActorApiKeyInTenant(deps.apiKeys, ctx, record.actorApiKeyId)
      }

      const parsed = auditLogRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEARCHABLE_FIELDS,
        filterableFields: FILTERABLE_FIELDS,
        defaultSort: DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteAuditLogRepository(adapter: StorageAdapter): AuditLogRepository {
  const base = createTenantSqliteRepository<AuditLogRecord>(adapter, {
    tableName: 'audit_logs',
    columns: [
      'id',
      'organization_id',
      'actor_user_id',
      'actor_api_key_id',
      'entity_type',
      'entity_id',
      'action',
      'before',
      'after',
      'request_id',
      'metadata',
      'occurred_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        actor_user_id: record.actorUserId ?? null,
        actor_api_key_id: record.actorApiKeyId ?? null,
        entity_type: record.entityType,
        entity_id: record.entityId,
        action: record.action,
        before: record.before != null ? toSqliteJson(record.before) : null,
        after: record.after != null ? toSqliteJson(record.after) : null,
        request_id: record.requestId ?? null,
        metadata: toSqliteJson(record.metadata),
        occurred_at: toSqliteDate(record.occurredAt),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return auditLogRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        actorUserId: row.actor_user_id ?? null,
        actorApiKeyId: row.actor_api_key_id ?? null,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        before: fromSqliteJson(row.before, null),
        after: fromSqliteJson(row.after, null),
        requestId: row.request_id ?? null,
        metadata: fromSqliteJson(row.metadata, {}),
        occurredAt: fromSqliteDate(row.occurred_at),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Audit log organization mismatch')
      }

      if (record.actorUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.actorUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor user ${record.actorUserId} not found in this organization`,
          })
        }
      }
      if (record.actorApiKeyId) {
        const keys = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from api_keys where id = ${record.actorApiKeyId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!keys[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor API key ${record.actorApiKeyId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresAuditLogRepository(adapter: StorageAdapter): AuditLogRepository {
  const base = createTenantPostgresRepository<AuditLogRecord>(adapter, {
    tableName: 'audit_logs',
    columns: [
      'id',
      'organization_id',
      'actor_user_id',
      'actor_api_key_id',
      'entity_type',
      'entity_id',
      'action',
      'before',
      'after',
      'request_id',
      'metadata',
      'occurred_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        actor_user_id: record.actorUserId ?? null,
        actor_api_key_id: record.actorApiKeyId ?? null,
        entity_type: record.entityType,
        entity_id: record.entityId,
        action: record.action,
        before: record.before ?? null,
        after: record.after ?? null,
        request_id: record.requestId ?? null,
        metadata: record.metadata ?? {},
        occurred_at: record.occurredAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return auditLogRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        actorUserId: row.actor_user_id ?? null,
        actorApiKeyId: row.actor_api_key_id ?? null,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        before: fromPostgresJson(row.before, null),
        after: fromPostgresJson(row.after, null),
        requestId: row.request_id ?? null,
        metadata: fromPostgresJson(row.metadata, {}),
        occurredAt: fromPostgresDate(row.occurred_at),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Audit log organization mismatch')
      }

      if (record.actorUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.actorUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor user ${record.actorUserId} not found in this organization`,
          })
        }
      }
      if (record.actorApiKeyId) {
        const keys = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from api_keys where id = ${record.actorApiKeyId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!keys[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Actor API key ${record.actorApiKeyId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 10: Create auditLogs admin service

**Files:**
- Create: `packages/core/src/entities/audit-logs/service.ts`

- [ ] **Step 1: Write the service file**

Create `packages/core/src/entities/audit-logs/service.ts`:

```typescript
import type { AdminEntityService } from '../../services/entity-service.js'
import type { AuditLogRepository } from './repository.js'
import { sanitizeAuditLogRecord, type SanitizedAuditLogRecord } from './validators.js'

export function createAuditLogAdminService(
  repository: AuditLogRepository,
): AdminEntityService<SanitizedAuditLogRecord> {
  return {
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeAuditLogRecord),
      }
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeAuditLogRecord(record) : null
    },
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 11: Write auditLogs tests

**Files:**
- Create: `packages/core/src/entities/audit-logs/service.test.ts`

- [ ] **Step 1: Write the test file**

Create `packages/core/src/entities/audit-logs/service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemoryApiKeyRepository } from '../api-keys/repository.js'
import { createInMemoryAuditLogRepository } from './repository.js'
import { createAuditLogAdminService } from './service.js'
import type { AuditLogRecord } from './validators.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

const userId = 'user_01ARYZ6S41YYYYYYYYYYYYYYYY'
const apiKeyId = 'key_01ARYZ6S41YYYYYYYYYYYYYYYY'

function makeRecord(overrides: Partial<AuditLogRecord> = {}): AuditLogRecord {
  return {
    id: generateId('auditLog'),
    organizationId: ctx.orgId,
    actorUserId: userId,
    actorApiKeyId: null,
    entityType: 'contacts',
    entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
    action: 'create',
    before: null,
    after: { name: 'Alice', email: 'alice@example.com' },
    requestId: 'req_123',
    metadata: {},
    occurredAt: new Date('2026-04-02T12:00:00.000Z'),
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

function createUsersForOrg() {
  return createInMemoryUserRepository([
    {
      id: userId,
      organizationId: ctx.orgId,
      email: 'actor@example.com',
      name: 'Actor',
      role: 'admin',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    },
  ])
}

function createApiKeysForOrg() {
  return createInMemoryApiKeyRepository([
    {
      id: apiKeyId,
      organizationId: ctx.orgId,
      name: 'Test Key',
      keyHash: 'hash123',
      keyPrefix: 'orb_test_',
      scopes: ['*'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdByUserId: userId,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    },
  ])
}

describe('audit log admin service', () => {
  it('lists audit logs within org scope', async () => {
    const repository = createInMemoryAuditLogRepository()
    const service = createAuditLogAdminService(repository)

    await repository.create(ctx, makeRecord())

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.entityType).toBe('contacts')
    expect(result.data[0]?.action).toBe('create')
  })

  it('gets a single audit log by id', async () => {
    const repository = createInMemoryAuditLogRepository()
    const service = createAuditLogAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
    expect(fetched?.actorUserId).toBe(userId)
  })

  it('tenant isolation: org B cannot see org A audit logs', async () => {
    const repository = createInMemoryAuditLogRepository()
    const service = createAuditLogAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    expect(await service.get(ctxB, record.id)).toBeNull()
    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('sanitizes before and after fields from admin reads', async () => {
    const repository = createInMemoryAuditLogRepository()
    const service = createAuditLogAdminService(repository)

    await repository.create(ctx, makeRecord({
      before: { secret: 'old_value' },
      after: { secret: 'new_value' },
    }))

    const result = await service.list(ctx, { limit: 10 })
    const entry = result.data[0]!
    expect(entry).not.toHaveProperty('before')
    expect(entry).not.toHaveProperty('after')
  })

  it('sanitizes before and after from get reads', async () => {
    const repository = createInMemoryAuditLogRepository()
    const service = createAuditLogAdminService(repository)

    const record = await repository.create(ctx, makeRecord({
      before: { data: 'sensitive' },
      after: { data: 'also_sensitive' },
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched).not.toHaveProperty('before')
    expect(fetched).not.toHaveProperty('after')
  })

  it('validates same-tenant actor user reference', async () => {
    const users = createUsersForOrg()
    const repository = createInMemoryAuditLogRepository([], { users })

    // Cross-tenant user reference should fail
    const crossTenantUserId = 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ'
    await expect(
      repository.create(ctx, makeRecord({ actorUserId: crossTenantUserId })),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })
  })

  it('validates same-tenant actor API key reference', async () => {
    const apiKeys = createApiKeysForOrg()
    const repository = createInMemoryAuditLogRepository([], { apiKeys })

    const crossTenantKeyId = 'key_01ARYZ6S41ZZZZZZZZZZZZZZZZ'
    await expect(
      repository.create(ctx, makeRecord({
        actorUserId: null,
        actorApiKeyId: crossTenantKeyId,
      })),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })
  })

  it('preserves metadata and requestId through reads', async () => {
    const repository = createInMemoryAuditLogRepository()
    const service = createAuditLogAdminService(repository)

    const record = await repository.create(ctx, makeRecord({
      metadata: { source: 'api', version: 2 },
      requestId: 'req_456',
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.metadata).toEqual({ source: 'api', version: 2 })
    expect(fetched?.requestId).toBe('req_456')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @orbit-ai/core test -- --run packages/core/src/entities/audit-logs/service.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/entities/audit-logs/
git add packages/core/src/entities/custom-field-definitions/
git commit -m "feat(core): add auditLogs validators, repository, service, and tests"
```

---

## Workstream B: Metadata System Surfaces (schemaMigrations + idempotencyKeys)

### Task 12: Add Drizzle table definitions for schemaMigrations and idempotencyKeys

**Files:**
- Modify: `packages/core/src/schema/tables.ts` (append after auditLogs)

- [ ] **Step 1: Add the schemaMigrations table**

Append to `packages/core/src/schema/tables.ts`:

```typescript
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
```

- [ ] **Step 2: Add the idempotencyKeys table**

Continue appending:

```typescript
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

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/schema/tables.ts
git commit -m "feat(core): add Drizzle table definitions for schemaMigrations and idempotencyKeys"
```

---

### Task 13: Add Drizzle relations for schemaMigrations and idempotencyKeys

**Files:**
- Modify: `packages/core/src/schema/relations.ts`

- [ ] **Step 1: Import schemaMigrations and idempotencyKeys**

The imports were already updated in Task 2. Verify that `schemaMigrations` and `idempotencyKeys` are in the import from `'./tables.js'`. If not, add them.

- [ ] **Step 2: Add to organizationsRelations**

Add `schemaMigrations: many(schemaMigrations)` and `idempotencyKeys: many(idempotencyKeys)` to the existing `organizationsRelations` (which was updated in Task 2).

- [ ] **Step 3: Add schemaMigrations relations**

Append:

```typescript
export const schemaMigrationsRelations = relations(schemaMigrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [schemaMigrations.organizationId],
    references: [organizations.id],
  }),
  appliedBy: one(users, {
    relationName: 'schemaMigrationAppliedBy',
    fields: [schemaMigrations.appliedByUserId],
    references: [users.id],
  }),
  approvedBy: one(users, {
    relationName: 'schemaMigrationApprovedBy',
    fields: [schemaMigrations.approvedByUserId],
    references: [users.id],
  }),
}))
```

- [ ] **Step 4: Add idempotencyKeys relations**

Append:

```typescript
export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [idempotencyKeys.organizationId],
    references: [organizations.id],
  }),
}))
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schema/relations.ts
git commit -m "feat(core): add Drizzle relations for schemaMigrations and idempotencyKeys"
```

---

### Task 14: Add Zod schemas for schemaMigrations and idempotencyKeys

**Files:**
- Modify: `packages/core/src/schema/zod.ts`

- [ ] **Step 1: Import the new tables**

Add `schemaMigrations` and `idempotencyKeys` to the import from `'./tables.js'`.

- [ ] **Step 2: Add schemaMigrations Zod schemas**

Append:

```typescript
// Schema Migrations
export const schemaMigrationSelectSchema = createSelectSchema(schemaMigrations, {
  id: orbitId('migration'),
  organizationId: orbitId('organization'),
  appliedByUserId: orbitId('user').optional().nullable(),
  approvedByUserId: orbitId('user').optional().nullable(),
})
export const schemaMigrationInsertSchema = createInsertSchema(schemaMigrations, {
  organizationId: orbitId('organization'),
  appliedByUserId: orbitId('user').optional().nullable(),
  approvedByUserId: orbitId('user').optional().nullable(),
})
export const schemaMigrationUpdateSchema = createUpdateSchema(schemaMigrations, {
  organizationId: orbitId('organization').optional(),
  appliedByUserId: orbitId('user').optional().nullable(),
  approvedByUserId: orbitId('user').optional().nullable(),
})
```

- [ ] **Step 3: Add idempotencyKeys Zod schemas**

Append:

```typescript
// Idempotency Keys
export const idempotencyKeySelectSchema = createSelectSchema(idempotencyKeys, {
  id: orbitId('idempotencyKey'),
  organizationId: orbitId('organization'),
})
export const idempotencyKeyInsertSchema = createInsertSchema(idempotencyKeys, {
  organizationId: orbitId('organization'),
})
export const idempotencyKeyUpdateSchema = createUpdateSchema(idempotencyKeys, {
  organizationId: orbitId('organization').optional(),
})
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema/zod.ts
git commit -m "feat(core): add Zod schemas for schemaMigrations and idempotencyKeys"
```

---

### Task 15: Create schemaMigrations validators and repository

**Files:**
- Create: `packages/core/src/entities/schema-migrations/validators.ts`
- Create: `packages/core/src/entities/schema-migrations/repository.ts`

- [ ] **Step 1: Write the validators file**

Create `packages/core/src/entities/schema-migrations/validators.ts`:

```typescript
import { z } from 'zod'

import { schemaMigrationSelectSchema, schemaMigrationInsertSchema } from '../../schema/zod.js'

export const schemaMigrationRecordSchema = schemaMigrationSelectSchema
export type SchemaMigrationRecord = z.infer<typeof schemaMigrationRecordSchema>

export const schemaMigrationCreateInputSchema = schemaMigrationInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SchemaMigrationCreateInput = z.input<typeof schemaMigrationCreateInputSchema>
```

Note: No redaction needed for schemaMigrations — SQL statements are operational metadata, not user secrets.

- [ ] **Step 2: Write the repository file**

Create `packages/core/src/entities/schema-migrations/repository.ts`:

```typescript
import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresDate,
  fromPostgresJson,
} from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { schemaMigrationRecordSchema, type SchemaMigrationRecord } from './validators.js'
import type { UserRepository } from '../users/repository.js'

export interface SchemaMigrationRepository {
  create(ctx: OrbitAuthContext, record: SchemaMigrationRecord): Promise<SchemaMigrationRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SchemaMigrationRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SchemaMigrationRecord>>
}

const SEARCHABLE_FIELDS = ['description', 'entity_type', 'operation_type']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'entity_type',
  'operation_type',
  'applied_by_user_id',
  'approved_by_user_id',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

async function assertUserInTenant(
  users: Pick<UserRepository, 'get'>,
  ctx: OrbitAuthContext,
  userId: string,
  role: string,
): Promise<void> {
  const user = await users.get(ctx, userId)
  if (!user) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `${role} user ${userId} not found in this organization`,
    })
  }
}

export function createInMemorySchemaMigrationRepository(
  seed: SchemaMigrationRecord[] = [],
  deps: {
    users?: Pick<UserRepository, 'get'>
  } = {},
): SchemaMigrationRepository {
  const rows = new Map(seed.map((r) => [r.id, schemaMigrationRecordSchema.parse(r)]))

  function scopedRows(ctx: OrbitAuthContext): SchemaMigrationRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((r) => r.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Schema migration organization mismatch')
      }

      if (record.appliedByUserId && deps.users) {
        await assertUserInTenant(deps.users, ctx, record.appliedByUserId, 'Applied-by')
      }
      if (record.approvedByUserId && deps.users) {
        await assertUserInTenant(deps.users, ctx, record.approvedByUserId, 'Approved-by')
      }

      const parsed = schemaMigrationRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEARCHABLE_FIELDS,
        filterableFields: FILTERABLE_FIELDS,
        defaultSort: DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteSchemaMigrationRepository(adapter: StorageAdapter): SchemaMigrationRepository {
  const base = createTenantSqliteRepository<SchemaMigrationRecord>(adapter, {
    tableName: 'schema_migrations',
    columns: [
      'id',
      'organization_id',
      'description',
      'entity_type',
      'operation_type',
      'sql_statements',
      'rollback_statements',
      'applied_by_user_id',
      'approved_by_user_id',
      'applied_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        description: record.description,
        entity_type: record.entityType ?? null,
        operation_type: record.operationType,
        sql_statements: toSqliteJson(record.sqlStatements),
        rollback_statements: toSqliteJson(record.rollbackStatements),
        applied_by_user_id: record.appliedByUserId ?? null,
        approved_by_user_id: record.approvedByUserId ?? null,
        applied_at: toSqliteDate(record.appliedAt),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return schemaMigrationRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        description: row.description,
        entityType: row.entity_type ?? null,
        operationType: row.operation_type,
        sqlStatements: fromSqliteJson(row.sql_statements, []),
        rollbackStatements: fromSqliteJson(row.rollback_statements, []),
        appliedByUserId: row.applied_by_user_id ?? null,
        approvedByUserId: row.approved_by_user_id ?? null,
        appliedAt: fromSqliteDate(row.applied_at),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Schema migration organization mismatch')
      }

      if (record.appliedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.appliedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Applied-by user ${record.appliedByUserId} not found in this organization`,
          })
        }
      }
      if (record.approvedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.approvedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Approved-by user ${record.approvedByUserId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresSchemaMigrationRepository(adapter: StorageAdapter): SchemaMigrationRepository {
  const base = createTenantPostgresRepository<SchemaMigrationRecord>(adapter, {
    tableName: 'schema_migrations',
    columns: [
      'id',
      'organization_id',
      'description',
      'entity_type',
      'operation_type',
      'sql_statements',
      'rollback_statements',
      'applied_by_user_id',
      'approved_by_user_id',
      'applied_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        description: record.description,
        entity_type: record.entityType ?? null,
        operation_type: record.operationType,
        sql_statements: record.sqlStatements,
        rollback_statements: record.rollbackStatements,
        applied_by_user_id: record.appliedByUserId ?? null,
        approved_by_user_id: record.approvedByUserId ?? null,
        applied_at: record.appliedAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return schemaMigrationRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        description: row.description,
        entityType: row.entity_type ?? null,
        operationType: row.operation_type,
        sqlStatements: fromPostgresJson(row.sql_statements, []),
        rollbackStatements: fromPostgresJson(row.rollback_statements, []),
        appliedByUserId: row.applied_by_user_id ?? null,
        approvedByUserId: row.approved_by_user_id ?? null,
        appliedAt: fromPostgresDate(row.applied_at),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Schema migration organization mismatch')
      }

      if (record.appliedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.appliedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Applied-by user ${record.appliedByUserId} not found in this organization`,
          })
        }
      }
      if (record.approvedByUserId) {
        const users = await adapter.withTenantContext(ctx, async (db) =>
          db.query<Record<string, unknown>>(
            sql`select id from users where id = ${record.approvedByUserId} and organization_id = ${orgId} limit 1`,
          ),
        )
        if (!users[0]) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `Approved-by user ${record.approvedByUserId} not found in this organization`,
          })
        }
      }

      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

---

### Task 16: Create schemaMigrations admin service and tests

**Files:**
- Create: `packages/core/src/entities/schema-migrations/service.ts`
- Create: `packages/core/src/entities/schema-migrations/service.test.ts`

- [ ] **Step 1: Write the service file**

Create `packages/core/src/entities/schema-migrations/service.ts`:

```typescript
import type { AdminEntityService } from '../../services/entity-service.js'
import type { SchemaMigrationRepository } from './repository.js'
import type { SchemaMigrationRecord } from './validators.js'

export function createSchemaMigrationAdminService(
  repository: SchemaMigrationRepository,
): AdminEntityService<SchemaMigrationRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
```

- [ ] **Step 2: Write the test file**

Create `packages/core/src/entities/schema-migrations/service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemorySchemaMigrationRepository } from './repository.js'
import { createSchemaMigrationAdminService } from './service.js'
import type { SchemaMigrationRecord } from './validators.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

const userId = 'user_01ARYZ6S41YYYYYYYYYYYYYYYY'

function makeRecord(overrides: Partial<SchemaMigrationRecord> = {}): SchemaMigrationRecord {
  return {
    id: generateId('migration'),
    organizationId: ctx.orgId,
    description: 'Add priority column to contacts',
    entityType: 'contacts',
    operationType: 'add_column',
    sqlStatements: ['ALTER TABLE contacts ADD COLUMN priority TEXT'],
    rollbackStatements: ['ALTER TABLE contacts DROP COLUMN priority'],
    appliedByUserId: userId,
    approvedByUserId: null,
    appliedAt: new Date('2026-04-02T12:00:00.000Z'),
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

function createUsersForOrg() {
  return createInMemoryUserRepository([
    {
      id: userId,
      organizationId: ctx.orgId,
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    },
  ])
}

describe('schema migration admin service', () => {
  it('lists schema migrations within org scope', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const service = createSchemaMigrationAdminService(repository)

    await repository.create(ctx, makeRecord())

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.operationType).toBe('add_column')
  })

  it('gets a single schema migration by id', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const service = createSchemaMigrationAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
    expect(fetched?.description).toBe('Add priority column to contacts')
  })

  it('tenant isolation: org B cannot see org A schema migrations', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const service = createSchemaMigrationAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    expect(await service.get(ctxB, record.id)).toBeNull()
    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('persists and round-trips JSON array fields (sqlStatements, rollbackStatements)', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const service = createSchemaMigrationAdminService(repository)

    const statements = [
      'ALTER TABLE contacts ADD COLUMN priority TEXT',
      'CREATE INDEX contacts_priority_idx ON contacts (priority)',
    ]
    const rollback = [
      'DROP INDEX contacts_priority_idx',
      'ALTER TABLE contacts DROP COLUMN priority',
    ]

    const record = await repository.create(ctx, makeRecord({
      sqlStatements: statements,
      rollbackStatements: rollback,
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.sqlStatements).toEqual(statements)
    expect(fetched?.rollbackStatements).toEqual(rollback)
  })

  it('validates same-tenant appliedByUserId reference', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const crossTenantUserId = 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ'
    await expect(
      repository.create(ctx, makeRecord({ appliedByUserId: crossTenantUserId })),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })
  })

  it('validates same-tenant approvedByUserId reference', async () => {
    const users = createUsersForOrg()
    const repository = createInMemorySchemaMigrationRepository([], { users })

    const crossTenantUserId = 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ'
    await expect(
      repository.create(ctx, makeRecord({ approvedByUserId: crossTenantUserId })),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })
  })

  it('preserves nullable entityType field', async () => {
    const repository = createInMemorySchemaMigrationRepository()
    const service = createSchemaMigrationAdminService(repository)

    const record = await repository.create(ctx, makeRecord({ entityType: null }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.entityType).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @orbit-ai/core test -- --run packages/core/src/entities/schema-migrations/service.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/entities/schema-migrations/
git commit -m "feat(core): add schemaMigrations validators, repository, service, and tests"
```

---

### Task 17: Create idempotencyKeys validators, repository, service, and tests

**Files:**
- Create: `packages/core/src/entities/idempotency-keys/validators.ts`
- Create: `packages/core/src/entities/idempotency-keys/repository.ts`
- Create: `packages/core/src/entities/idempotency-keys/service.ts`
- Create: `packages/core/src/entities/idempotency-keys/service.test.ts`

- [ ] **Step 1: Write the validators file**

Create `packages/core/src/entities/idempotency-keys/validators.ts`:

```typescript
import { z } from 'zod'

import { idempotencyKeySelectSchema, idempotencyKeyInsertSchema } from '../../schema/zod.js'

export const idempotencyKeyRecordSchema = idempotencyKeySelectSchema
export type IdempotencyKeyRecord = z.infer<typeof idempotencyKeyRecordSchema>

export const sanitizedIdempotencyKeyRecordSchema = idempotencyKeyRecordSchema.omit({
  requestHash: true,
  responseBody: true,
})
export type SanitizedIdempotencyKeyRecord = z.infer<typeof sanitizedIdempotencyKeyRecordSchema>

export function sanitizeIdempotencyKeyRecord(record: IdempotencyKeyRecord): SanitizedIdempotencyKeyRecord {
  return sanitizedIdempotencyKeyRecordSchema.parse(record)
}

export const idempotencyKeyCreateInputSchema = idempotencyKeyInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type IdempotencyKeyCreateInput = z.input<typeof idempotencyKeyCreateInputSchema>
```

- [ ] **Step 2: Write the repository file**

Create `packages/core/src/entities/idempotency-keys/repository.ts`:

```typescript
import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import {
  createTenantSqliteRepository,
  fromSqliteDate,
  fromSqliteJson,
  toSqliteDate,
  toSqliteJson,
} from '../../repositories/sqlite/shared.js'
import {
  createTenantPostgresRepository,
  fromPostgresDate,
  fromPostgresJson,
} from '../../repositories/postgres/shared.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { idempotencyKeyRecordSchema, type IdempotencyKeyRecord } from './validators.js'

export interface IdempotencyKeyRepository {
  create(ctx: OrbitAuthContext, record: IdempotencyKeyRecord): Promise<IdempotencyKeyRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<IdempotencyKeyRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<IdempotencyKeyRecord>>
}

const SEARCHABLE_FIELDS = ['key', 'method', 'path']
const FILTERABLE_FIELDS = [
  'id',
  'organization_id',
  'key',
  'method',
  'path',
  'response_code',
]
const DEFAULT_SORT: Array<{ field: string; direction: 'asc' | 'desc' }> = [
  { field: 'created_at', direction: 'desc' },
]

export function createInMemoryIdempotencyKeyRepository(
  seed: IdempotencyKeyRecord[] = [],
): IdempotencyKeyRepository {
  const rows = new Map(seed.map((r) => [r.id, idempotencyKeyRecordSchema.parse(r)]))

  function scopedRows(ctx: OrbitAuthContext): IdempotencyKeyRecord[] {
    const orgId = assertOrgContext(ctx)
    return [...rows.values()].filter((r) => r.organizationId === orgId)
  }

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Idempotency key organization mismatch')
      }

      // Uniqueness: (organizationId, key, method, path)
      for (const existing of rows.values()) {
        if (
          existing.organizationId === record.organizationId &&
          existing.key === record.key &&
          existing.method === record.method &&
          existing.path === record.path
        ) {
          throw createOrbitError({
            code: 'CONFLICT',
            message: `Idempotency key already exists for ${record.method} ${record.path} with key ${record.key}`,
          })
        }
      }

      const parsed = idempotencyKeyRecordSchema.parse(record)
      rows.set(parsed.id, parsed)
      return parsed
    },
    async get(ctx, id) {
      const orgId = assertOrgContext(ctx)
      const record = rows.get(id)
      return record && record.organizationId === orgId ? record : null
    },
    async list(ctx, query) {
      return runArrayQuery(scopedRows(ctx), query, {
        searchableFields: SEARCHABLE_FIELDS,
        filterableFields: FILTERABLE_FIELDS,
        defaultSort: DEFAULT_SORT,
      })
    },
  }
}

export function createSqliteIdempotencyKeyRepository(adapter: StorageAdapter): IdempotencyKeyRepository {
  const base = createTenantSqliteRepository<IdempotencyKeyRecord>(adapter, {
    tableName: 'idempotency_keys',
    columns: [
      'id',
      'organization_id',
      'key',
      'method',
      'path',
      'request_hash',
      'response_code',
      'response_body',
      'locked_until',
      'completed_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        key: record.key,
        method: record.method,
        path: record.path,
        request_hash: record.requestHash,
        response_code: record.responseCode ?? null,
        response_body: record.responseBody != null ? toSqliteJson(record.responseBody) : null,
        locked_until: toSqliteDate(record.lockedUntil),
        completed_at: toSqliteDate(record.completedAt),
        created_at: toSqliteDate(record.createdAt),
        updated_at: toSqliteDate(record.updatedAt),
      }
    },
    deserialize(row) {
      return idempotencyKeyRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        key: row.key,
        method: row.method,
        path: row.path,
        requestHash: row.request_hash,
        responseCode: row.response_code ?? null,
        responseBody: fromSqliteJson(row.response_body, null),
        lockedUntil: fromSqliteDate(row.locked_until),
        completedAt: fromSqliteDate(row.completed_at),
        createdAt: fromSqliteDate(row.created_at),
        updatedAt: fromSqliteDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Idempotency key organization mismatch')
      }
      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}

export function createPostgresIdempotencyKeyRepository(adapter: StorageAdapter): IdempotencyKeyRepository {
  const base = createTenantPostgresRepository<IdempotencyKeyRecord>(adapter, {
    tableName: 'idempotency_keys',
    columns: [
      'id',
      'organization_id',
      'key',
      'method',
      'path',
      'request_hash',
      'response_code',
      'response_body',
      'locked_until',
      'completed_at',
      'created_at',
      'updated_at',
    ],
    searchableFields: SEARCHABLE_FIELDS,
    filterableFields: FILTERABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
    serialize(record) {
      return {
        id: record.id,
        organization_id: record.organizationId,
        key: record.key,
        method: record.method,
        path: record.path,
        request_hash: record.requestHash,
        response_code: record.responseCode ?? null,
        response_body: record.responseBody ?? null,
        locked_until: record.lockedUntil,
        completed_at: record.completedAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
    },
    deserialize(row) {
      return idempotencyKeyRecordSchema.parse({
        id: row.id,
        organizationId: row.organization_id,
        key: row.key,
        method: row.method,
        path: row.path,
        requestHash: row.request_hash,
        responseCode: row.response_code ?? null,
        responseBody: fromPostgresJson(row.response_body, null),
        lockedUntil: fromPostgresDate(row.locked_until),
        completedAt: fromPostgresDate(row.completed_at),
        createdAt: fromPostgresDate(row.created_at),
        updatedAt: fromPostgresDate(row.updated_at),
      })
    },
  })

  return {
    async create(ctx, record) {
      const orgId = assertOrgContext(ctx)
      if (record.organizationId !== orgId) {
        throw new Error('Idempotency key organization mismatch')
      }
      return base.create(ctx, record)
    },
    get: base.get.bind(base),
    list: base.list.bind(base),
  }
}
```

- [ ] **Step 3: Write the service file**

Create `packages/core/src/entities/idempotency-keys/service.ts`:

```typescript
import type { AdminEntityService } from '../../services/entity-service.js'
import type { IdempotencyKeyRepository } from './repository.js'
import { sanitizeIdempotencyKeyRecord, type SanitizedIdempotencyKeyRecord } from './validators.js'

export function createIdempotencyKeyAdminService(
  repository: IdempotencyKeyRepository,
): AdminEntityService<SanitizedIdempotencyKeyRecord> {
  return {
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeIdempotencyKeyRecord),
      }
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeIdempotencyKeyRecord(record) : null
    },
  }
}
```

- [ ] **Step 4: Write the test file**

Create `packages/core/src/entities/idempotency-keys/service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryIdempotencyKeyRepository } from './repository.js'
import { createIdempotencyKeyAdminService } from './service.js'
import type { IdempotencyKeyRecord } from './validators.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

function makeRecord(overrides: Partial<IdempotencyKeyRecord> = {}): IdempotencyKeyRecord {
  return {
    id: generateId('idempotencyKey'),
    organizationId: ctx.orgId,
    key: 'idem_abc123',
    method: 'POST',
    path: '/api/v1/contacts',
    requestHash: 'sha256_deadbeef',
    responseCode: 201,
    responseBody: { id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    lockedUntil: null,
    completedAt: new Date('2026-04-02T12:00:00.000Z'),
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('idempotency key admin service', () => {
  it('lists idempotency keys within org scope', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()
    const service = createIdempotencyKeyAdminService(repository)

    await repository.create(ctx, makeRecord())

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.method).toBe('POST')
    expect(result.data[0]?.path).toBe('/api/v1/contacts')
  })

  it('gets a single idempotency key by id', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()
    const service = createIdempotencyKeyAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.id).toBe(record.id)
    expect(fetched?.key).toBe('idem_abc123')
  })

  it('tenant isolation: org B cannot see org A idempotency keys', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()
    const service = createIdempotencyKeyAdminService(repository)

    const record = await repository.create(ctx, makeRecord())

    expect(await service.get(ctxB, record.id)).toBeNull()
    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('rejects duplicate (organizationId, key, method, path)', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()

    await repository.create(ctx, makeRecord())

    await expect(
      repository.create(ctx, makeRecord({ id: generateId('idempotencyKey') })),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('allows same key for different methods', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()

    await repository.create(ctx, makeRecord({ method: 'POST' }))

    const second = await repository.create(ctx, makeRecord({
      id: generateId('idempotencyKey'),
      method: 'PUT',
    }))

    expect(second.method).toBe('PUT')
  })

  it('sanitizes requestHash and responseBody from admin list reads', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()
    const service = createIdempotencyKeyAdminService(repository)

    await repository.create(ctx, makeRecord({
      requestHash: 'sha256_secret_hash',
      responseBody: { secret: 'data' },
    }))

    const result = await service.list(ctx, { limit: 10 })
    const entry = result.data[0]!
    expect(entry).not.toHaveProperty('requestHash')
    expect(entry).not.toHaveProperty('responseBody')
    // Preserved fields
    expect(entry.key).toBe('idem_abc123')
    expect(entry.responseCode).toBe(201)
  })

  it('sanitizes requestHash and responseBody from admin get reads', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()
    const service = createIdempotencyKeyAdminService(repository)

    const record = await repository.create(ctx, makeRecord({
      requestHash: 'sha256_another_hash',
      responseBody: { data: 'sensitive' },
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched).not.toHaveProperty('requestHash')
    expect(fetched).not.toHaveProperty('responseBody')
    expect(fetched?.key).toBe('idem_abc123')
  })

  it('preserves lifecycle metadata (lockedUntil, completedAt)', async () => {
    const repository = createInMemoryIdempotencyKeyRepository()
    const service = createIdempotencyKeyAdminService(repository)

    const lockedUntil = new Date('2026-04-02T12:05:00.000Z')
    const completedAt = new Date('2026-04-02T12:01:00.000Z')

    const record = await repository.create(ctx, makeRecord({
      lockedUntil,
      completedAt,
    }))

    const fetched = await service.get(ctx, record.id)
    expect(fetched?.lockedUntil).toEqual(lockedUntil)
    expect(fetched?.completedAt).toEqual(completedAt)
  })
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @orbit-ai/core test -- --run packages/core/src/entities/idempotency-keys/service.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/entities/idempotency-keys/
git commit -m "feat(core): add idempotencyKeys validators, repository, service, and tests"
```

---

## Workstream C: Integration, Proofs, and Docs

### Task 18: Register Slice E entities in tenant-scope

**Files:**
- Modify: `packages/core/src/repositories/tenant-scope.ts`

- [ ] **Step 1: Add the four Slice E tables to IMPLEMENTED_TENANT_TABLES**

In `packages/core/src/repositories/tenant-scope.ts`, add to `IMPLEMENTED_TENANT_TABLES`:

```typescript
export const IMPLEMENTED_TENANT_TABLES = [
  'users',
  'organization_memberships',
  'api_keys',
  'companies',
  'contacts',
  'pipelines',
  'stages',
  'deals',
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
  'imports',
  'webhooks',
  'webhook_deliveries',
  'custom_field_definitions',
  'audit_logs',
  'schema_migrations',
  'idempotency_keys',
] as const
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/repositories/tenant-scope.ts
git commit -m "feat(core): register Slice E entities in tenant-scope"
```

---

### Task 19: Add SQLite bootstrap schema for Slice E

**Files:**
- Modify: `packages/core/src/adapters/sqlite/schema.ts`

- [ ] **Step 1: Add the Slice E schema statements array**

After `SQLITE_WAVE_2_SLICE_D_SCHEMA_STATEMENTS`, add:

```typescript
const SQLITE_WAVE_2_SLICE_E_SCHEMA_STATEMENTS = [
  ...SQLITE_WAVE_2_SLICE_D_SCHEMA_STATEMENTS,
  `create table if not exists custom_field_definitions (
    id text primary key,
    organization_id text not null references organizations(id),
    entity_type text not null,
    field_name text not null,
    field_type text not null,
    label text not null,
    description text,
    is_required integer not null default 0,
    is_indexed integer not null default 0,
    is_promoted integer not null default 0,
    promoted_column_name text,
    default_value text,
    options text not null default '[]',
    validation text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists custom_fields_unique_idx on custom_field_definitions (organization_id, entity_type, field_name)`,
  `create table if not exists audit_logs (
    id text primary key,
    organization_id text not null references organizations(id),
    actor_user_id text references users(id),
    actor_api_key_id text references api_keys(id),
    entity_type text not null,
    entity_id text not null,
    action text not null,
    before text,
    after text,
    request_id text,
    metadata text not null default '{}',
    occurred_at text not null default (datetime('now')),
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists audit_logs_entity_idx on audit_logs (organization_id, entity_type, entity_id)`,
  `create index if not exists audit_logs_occurred_at_idx on audit_logs (occurred_at)`,
  `create table if not exists schema_migrations (
    id text primary key,
    organization_id text not null references organizations(id),
    description text not null,
    entity_type text,
    operation_type text not null,
    sql_statements text not null default '[]',
    rollback_statements text not null default '[]',
    applied_by_user_id text references users(id),
    approved_by_user_id text references users(id),
    applied_at text,
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists schema_migrations_applied_at_idx on schema_migrations (applied_at)`,
  `create table if not exists idempotency_keys (
    id text primary key,
    organization_id text not null references organizations(id),
    key text not null,
    method text not null,
    path text not null,
    request_hash text not null,
    response_code integer,
    response_body text,
    locked_until text,
    completed_at text,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists idempotency_unique_idx on idempotency_keys (organization_id, key, method, path)`,
] as const
```

- [ ] **Step 2: Add the bootstrap helper function**

After the existing `initializeSqliteWave2SliceDSchema`, add:

```typescript
export async function initializeSqliteWave2SliceESchema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_2_SLICE_E_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/adapters/sqlite/schema.ts
git commit -m "feat(core): add SQLite bootstrap schema for Slice E"
```

---

### Task 20: Add Postgres bootstrap schema for Slice E

**Files:**
- Modify: `packages/core/src/adapters/postgres/schema.ts`

- [ ] **Step 1: Add the Slice E schema statements array**

After `POSTGRES_WAVE_2_SLICE_D_SCHEMA_STATEMENTS`, add:

```typescript
const POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS = [
  ...POSTGRES_WAVE_2_SLICE_D_SCHEMA_STATEMENTS,
  `create table if not exists custom_field_definitions (
    id text primary key,
    organization_id text not null references organizations(id),
    entity_type text not null,
    field_name text not null,
    field_type text not null,
    label text not null,
    description text,
    is_required boolean not null default false,
    is_indexed boolean not null default false,
    is_promoted boolean not null default false,
    promoted_column_name text,
    default_value jsonb,
    options jsonb not null default '[]'::jsonb,
    validation jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists custom_fields_unique_idx on custom_field_definitions (organization_id, entity_type, field_name)`,
  `create table if not exists audit_logs (
    id text primary key,
    organization_id text not null references organizations(id),
    actor_user_id text references users(id),
    actor_api_key_id text references api_keys(id),
    entity_type text not null,
    entity_id text not null,
    action text not null,
    before jsonb,
    after jsonb,
    request_id text,
    metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists audit_logs_entity_idx on audit_logs (organization_id, entity_type, entity_id)`,
  `create index if not exists audit_logs_occurred_at_idx on audit_logs (occurred_at)`,
  `create table if not exists schema_migrations (
    id text primary key,
    organization_id text not null references organizations(id),
    description text not null,
    entity_type text,
    operation_type text not null,
    sql_statements jsonb not null default '[]'::jsonb,
    rollback_statements jsonb not null default '[]'::jsonb,
    applied_by_user_id text references users(id),
    approved_by_user_id text references users(id),
    applied_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists schema_migrations_applied_at_idx on schema_migrations (applied_at)`,
  `create table if not exists idempotency_keys (
    id text primary key,
    organization_id text not null references organizations(id),
    key text not null,
    method text not null,
    path text not null,
    request_hash text not null,
    response_code integer,
    response_body jsonb,
    locked_until timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists idempotency_unique_idx on idempotency_keys (organization_id, key, method, path)`,
] as const
```

- [ ] **Step 2: Add the bootstrap helper function**

After the existing `initializePostgresWave2SliceDSchema`, add:

```typescript
export async function initializePostgresWave2SliceESchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/adapters/postgres/schema.ts
git commit -m "feat(core): add Postgres bootstrap schema for Slice E"
```

---

### Task 21: Wire Slice E into the service registry

**Files:**
- Modify: `packages/core/src/services/index.ts`

- [ ] **Step 1: Add imports for Slice E repositories and services**

Add at the top of `packages/core/src/services/index.ts` with the other entity imports:

```typescript
import {
  createPostgresCustomFieldDefinitionRepository,
  createSqliteCustomFieldDefinitionRepository,
  type CustomFieldDefinitionRepository,
} from '../entities/custom-field-definitions/repository.js'
import { createCustomFieldDefinitionAdminService } from '../entities/custom-field-definitions/service.js'
import {
  createPostgresAuditLogRepository,
  createSqliteAuditLogRepository,
  type AuditLogRepository,
} from '../entities/audit-logs/repository.js'
import { createAuditLogAdminService } from '../entities/audit-logs/service.js'
import {
  createPostgresSchemaMigrationRepository,
  createSqliteSchemaMigrationRepository,
  type SchemaMigrationRepository,
} from '../entities/schema-migrations/repository.js'
import { createSchemaMigrationAdminService } from '../entities/schema-migrations/service.js'
import {
  createPostgresIdempotencyKeyRepository,
  createSqliteIdempotencyKeyRepository,
  type IdempotencyKeyRepository,
} from '../entities/idempotency-keys/repository.js'
import { createIdempotencyKeyAdminService } from '../entities/idempotency-keys/service.js'
```

- [ ] **Step 2: Add Slice E entries to CoreRepositoryOverrides**

In the `CoreRepositoryOverrides` interface, add:

```typescript
  customFieldDefinitions?: CustomFieldDefinitionRepository
  auditLogs?: AuditLogRepository
  schemaMigrations?: SchemaMigrationRepository
  idempotencyKeys?: IdempotencyKeyRepository
```

- [ ] **Step 3: Add lazy repository variables and getters**

After the existing lazy repository variables (around line 319), add:

```typescript
  let customFieldDefinitionsRepository: CustomFieldDefinitionRepository | null = null
  let auditLogsRepository: AuditLogRepository | null = null
  let schemaMigrationsRepository: SchemaMigrationRepository | null = null
  let idempotencyKeysRepository: IdempotencyKeyRepository | null = null

  function getCustomFieldDefinitionsRepository(): CustomFieldDefinitionRepository {
    if (customFieldDefinitionsRepository) return customFieldDefinitionsRepository
    customFieldDefinitionsRepository = resolveCoreRepository({
      adapter,
      override: overrides.customFieldDefinitions,
      sqliteFactory: () => createSqliteCustomFieldDefinitionRepository(adapter),
      postgresFactory: () => createPostgresCustomFieldDefinitionRepository(adapter),
      name: 'custom field definitions repository',
    })
    return customFieldDefinitionsRepository
  }

  function getAuditLogsRepository(): AuditLogRepository {
    if (auditLogsRepository) return auditLogsRepository
    auditLogsRepository = resolveCoreRepository({
      adapter,
      override: overrides.auditLogs,
      sqliteFactory: () => createSqliteAuditLogRepository(adapter),
      postgresFactory: () => createPostgresAuditLogRepository(adapter),
      name: 'audit logs repository',
    })
    return auditLogsRepository
  }

  function getSchemaMigrationsRepository(): SchemaMigrationRepository {
    if (schemaMigrationsRepository) return schemaMigrationsRepository
    schemaMigrationsRepository = resolveCoreRepository({
      adapter,
      override: overrides.schemaMigrations,
      sqliteFactory: () => createSqliteSchemaMigrationRepository(adapter),
      postgresFactory: () => createPostgresSchemaMigrationRepository(adapter),
      name: 'schema migrations repository',
    })
    return schemaMigrationsRepository
  }

  function getIdempotencyKeysRepository(): IdempotencyKeyRepository {
    if (idempotencyKeysRepository) return idempotencyKeysRepository
    idempotencyKeysRepository = resolveCoreRepository({
      adapter,
      override: overrides.idempotencyKeys,
      sqliteFactory: () => createSqliteIdempotencyKeyRepository(adapter),
      postgresFactory: () => createPostgresIdempotencyKeyRepository(adapter),
      name: 'idempotency keys repository',
    })
    return idempotencyKeysRepository
  }
```

- [ ] **Step 4: Wire the four services into the system namespace**

Update the `system` block in the return statement to add the four new services:

```typescript
    system: {
      organizations: createOrganizationAdminService(organizations),
      organizationMemberships: createOrganizationMembershipAdminService(organizationMemberships),
      apiKeys: createApiKeyAdminService(apiKeys),
      entityTags: createEntityTagAdminService(getEntityTagsRepository()),
      webhookDeliveries: createWebhookDeliveryAdminService(getWebhookDeliveriesRepository()),
      customFieldDefinitions: createCustomFieldDefinitionAdminService(getCustomFieldDefinitionsRepository()),
      auditLogs: createAuditLogAdminService(getAuditLogsRepository()),
      schemaMigrations: createSchemaMigrationAdminService(getSchemaMigrationsRepository()),
      idempotencyKeys: createIdempotencyKeyAdminService(getIdempotencyKeysRepository()),
    },
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @orbit-ai/core typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/index.ts
git commit -m "feat(core): wire Slice E services into the Wave 2 registry"
```

---

### Task 22: Update package exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add Slice E entity exports**

Add to `packages/core/src/index.ts` after the existing entity exports:

```typescript
export * from './entities/custom-field-definitions/service.js'
export * from './entities/custom-field-definitions/repository.js'
export * from './entities/audit-logs/service.js'
export * from './entities/audit-logs/repository.js'
export * from './entities/schema-migrations/service.js'
export * from './entities/schema-migrations/repository.js'
export * from './entities/idempotency-keys/service.js'
export * from './entities/idempotency-keys/repository.js'
```

- [ ] **Step 2: Run typecheck and build**

Run: `pnpm --filter @orbit-ai/core typecheck && pnpm --filter @orbit-ai/core build`
Expected: Both PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export Slice E entity modules from package index"
```

---

### Task 23: Add registry shape and persistence proof tests

**Files:**
- Modify: `packages/core/src/services/index.test.ts`
- Modify: `packages/core/src/services/sqlite-persistence.test.ts`
- Modify: `packages/core/src/services/postgres-persistence.test.ts`

- [ ] **Step 1: Add registry shape assertions to index.test.ts**

This test file uses `createCoreServices(createTestAdapter(), { ...overrides })` to construct `services`. Follow the existing pattern in the file (see the first `it` block at line 138). Add Slice E in-memory repository imports and overrides, then add a new describe block.

Add these imports at the top of `packages/core/src/services/index.test.ts`:

```typescript
import { createInMemoryCustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import { createInMemoryAuditLogRepository } from '../entities/audit-logs/repository.js'
import { createInMemorySchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import { createInMemoryIdempotencyKeyRepository } from '../entities/idempotency-keys/repository.js'
```

Update the first test's `createCoreServices` overrides to include Slice E repos:

```typescript
    const customFieldDefinitions = createInMemoryCustomFieldDefinitionRepository()
    const auditLogs = createInMemoryAuditLogRepository()
    const schemaMigrations = createInMemorySchemaMigrationRepository()
    const idempotencyKeys = createInMemoryIdempotencyKeyRepository()

    const services = createCoreServices(createTestAdapter(), {
      // ... existing overrides ...
      customFieldDefinitions,
      auditLogs,
      schemaMigrations,
      idempotencyKeys,
    })
```

Then update the existing `Object.keys(services).sort()` assertion to include the unchanged top-level keys (no new top-level keys are added by Slice E — they go under `system`).

Add a new describe block:

```typescript
describe('Wave 2 Slice E registry shape', () => {
  it('exposes all 9 system entries with get and list', () => {
    const customFieldDefinitions = createInMemoryCustomFieldDefinitionRepository()
    const auditLogs = createInMemoryAuditLogRepository()
    const schemaMigrations = createInMemorySchemaMigrationRepository()
    const idempotencyKeys = createInMemoryIdempotencyKeyRepository()

    const services = createCoreServices(createTestAdapter(), {
      organizations: createInMemoryOrganizationRepository(),
      organizationMemberships: createInMemoryOrganizationMembershipRepository(),
      apiKeys: createInMemoryApiKeyRepository(),
      companies: createInMemoryCompanyRepository(),
      contacts: createInMemoryContactRepository(),
      pipelines: createInMemoryPipelineRepository(),
      stages: createInMemoryStageRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
      entityTags: createInMemoryEntityTagRepository(),
      webhookDeliveries: createInMemoryWebhookDeliveryRepository(),
      customFieldDefinitions,
      auditLogs,
      schemaMigrations,
      idempotencyKeys,
    })

    const systemKeys = Object.keys(services.system).sort()
    expect(systemKeys).toEqual([
      'apiKeys',
      'auditLogs',
      'customFieldDefinitions',
      'entityTags',
      'idempotencyKeys',
      'organizationMemberships',
      'organizations',
      'schemaMigrations',
      'webhookDeliveries',
    ])
    expect(systemKeys).toHaveLength(9)

    // All system entries have get and list
    expect(typeof services.system.customFieldDefinitions.get).toBe('function')
    expect(typeof services.system.customFieldDefinitions.list).toBe('function')
    expect(typeof services.system.auditLogs.get).toBe('function')
    expect(typeof services.system.auditLogs.list).toBe('function')
    expect(typeof services.system.schemaMigrations.get).toBe('function')
    expect(typeof services.system.schemaMigrations.list).toBe('function')
    expect(typeof services.system.idempotencyKeys.get).toBe('function')
    expect(typeof services.system.idempotencyKeys.list).toBe('function')

    // schema remains the only registry entry associated with schema-engine behavior
    expect(services.schema).toBeDefined()
    // system.schemaMigrations is read-only metadata, not schema-engine execution
    expect(services.system.schemaMigrations).not.toHaveProperty('apply')
    expect(services.system.schemaMigrations).not.toHaveProperty('approve')
    expect(services.system.schemaMigrations).not.toHaveProperty('rollback')
    expect(services.system.schemaMigrations).not.toHaveProperty('preview')
  })
})
```

- [ ] **Step 2: Add SQLite persistence proofs to sqlite-persistence.test.ts**

Add a new describe block for Slice E entities to `packages/core/src/services/sqlite-persistence.test.ts`.

First, update the import at the top of the file — the file is in `src/services/`, so imports use `../adapters/...`:

```typescript
import { initializeSqliteWave2SliceESchema } from '../adapters/sqlite/schema.js'
```

Update the existing `createSqliteAdapter()` to use `initializeSqliteWave2SliceESchema` instead of `initializeSqliteWave2SliceDSchema`, and add the four Slice E tables to the `tables` list in `getSchemaSnapshot`.

Then add a new test block following the existing pattern (which writes records via repos and reads back via service registry):

```typescript
  it('persists Slice E metadata records and verifies sanitization', async () => {
    const adapter = await createSqliteAdapter()
    const organizations = createSqliteOrganizationRepository(adapter)
    const { createSqliteUserRepository } = await import('../entities/users/repository.js')
    const userRepo = createSqliteUserRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await userRepo.create(ctxA, {
      id: ctxA.userId,
      organizationId: ctxA.orgId,
      email: 'admin@acme.test',
      name: 'Admin',
      role: 'admin',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const servicesA = createCoreServices(adapter)
    const { generateId } = await import('../ids/generate-id.js')

    // Custom Field Definition
    const { createSqliteCustomFieldDefinitionRepository } = await import('../entities/custom-field-definitions/repository.js')
    const cfdRepo = createSqliteCustomFieldDefinitionRepository(adapter)
    const cfd = await cfdRepo.create(ctxA, {
      id: generateId('customField'),
      organizationId: ctxA.orgId,
      entityType: 'contacts',
      fieldName: 'priority',
      fieldType: 'select',
      label: 'Priority',
      description: 'Priority level',
      isRequired: false,
      isIndexed: true,
      isPromoted: false,
      promotedColumnName: null,
      defaultValue: null,
      options: ['low', 'medium', 'high'],
      validation: { minLength: 1 },
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetchedCfd = await servicesA.system.customFieldDefinitions.get(ctxA, cfd.id)
    expect(fetchedCfd?.fieldName).toBe('priority')
    expect(fetchedCfd?.options).toEqual(['low', 'medium', 'high'])
    expect(fetchedCfd?.validation).toEqual({ minLength: 1 })
    expect(await servicesA.system.customFieldDefinitions.get(ctxB, cfd.id)).toBeNull()

    // Audit Log
    const { createSqliteAuditLogRepository } = await import('../entities/audit-logs/repository.js')
    const auditRepo = createSqliteAuditLogRepository(adapter)
    const audit = await auditRepo.create(ctxA, {
      id: generateId('auditLog'),
      organizationId: ctxA.orgId,
      actorUserId: ctxA.userId,
      actorApiKeyId: null,
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      action: 'create',
      before: null,
      after: { name: 'Alice' },
      requestId: 'req_1',
      metadata: {},
      occurredAt: new Date('2026-04-02T12:00:00.000Z'),
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetchedAudit = await servicesA.system.auditLogs.get(ctxA, audit.id)
    expect(fetchedAudit?.action).toBe('create')
    expect(fetchedAudit).not.toHaveProperty('before')
    expect(fetchedAudit).not.toHaveProperty('after')
    expect(await servicesA.system.auditLogs.get(ctxB, audit.id)).toBeNull()

    // Schema Migration
    const { createSqliteSchemaMigrationRepository } = await import('../entities/schema-migrations/repository.js')
    const migRepo = createSqliteSchemaMigrationRepository(adapter)
    const mig = await migRepo.create(ctxA, {
      id: generateId('migration'),
      organizationId: ctxA.orgId,
      description: 'Add priority',
      entityType: 'contacts',
      operationType: 'add_column',
      sqlStatements: ['ALTER TABLE contacts ADD COLUMN priority TEXT'],
      rollbackStatements: ['ALTER TABLE contacts DROP COLUMN priority'],
      appliedByUserId: ctxA.userId,
      approvedByUserId: null,
      appliedAt: new Date('2026-04-02T12:00:00.000Z'),
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetchedMig = await servicesA.system.schemaMigrations.get(ctxA, mig.id)
    expect(fetchedMig?.sqlStatements).toEqual(['ALTER TABLE contacts ADD COLUMN priority TEXT'])
    expect(fetchedMig?.rollbackStatements).toEqual(['ALTER TABLE contacts DROP COLUMN priority'])
    expect(await servicesA.system.schemaMigrations.get(ctxB, mig.id)).toBeNull()

    // Idempotency Key
    const { createSqliteIdempotencyKeyRepository } = await import('../entities/idempotency-keys/repository.js')
    const idemRepo = createSqliteIdempotencyKeyRepository(adapter)
    const idem = await idemRepo.create(ctxA, {
      id: generateId('idempotencyKey'),
      organizationId: ctxA.orgId,
      key: 'idem_test',
      method: 'POST',
      path: '/api/v1/contacts',
      requestHash: 'sha256_secret',
      responseCode: 201,
      responseBody: { id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY' },
      lockedUntil: null,
      completedAt: new Date('2026-04-02T12:00:00.000Z'),
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const fetchedIdem = await servicesA.system.idempotencyKeys.get(ctxA, idem.id)
    expect(fetchedIdem?.key).toBe('idem_test')
    expect(fetchedIdem?.responseCode).toBe(201)
    expect(fetchedIdem).not.toHaveProperty('requestHash')
    expect(fetchedIdem).not.toHaveProperty('responseBody')
    expect(await servicesA.system.idempotencyKeys.get(ctxB, idem.id)).toBeNull()
  })
```

- [ ] **Step 3: Add Postgres persistence proofs to postgres-persistence.test.ts**

Follow the same pattern for Postgres. Import `initializePostgresWave2SliceESchema` from `../adapters/postgres/schema.js` (note: `../adapters/`, not `../../adapters/`). Update the existing Postgres setup to use the Slice E bootstrap, add the four Slice E tables to the schema snapshot, and add a similar test block using Postgres repository constructors.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter @orbit-ai/core test`
Expected: All tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/index.test.ts
git add packages/core/src/services/sqlite-persistence.test.ts
git add packages/core/src/services/postgres-persistence.test.ts
git commit -m "feat(core): add Slice E registry shape assertions and persistence proofs"
```

---

### Task 24: Add entity AGENTS.MD files

**Files:**
- Create: `packages/core/src/entities/custom-field-definitions/AGENTS.MD`
- Create: `packages/core/src/entities/audit-logs/AGENTS.MD`
- Create: `packages/core/src/entities/schema-migrations/AGENTS.MD`
- Create: `packages/core/src/entities/idempotency-keys/AGENTS.MD`

- [ ] **Step 1: Create AGENTS.MD for custom-field-definitions**

```markdown
# Custom Field Definitions

Read-only admin/system service for schema metadata records. Exposed as `system.customFieldDefinitions`.

- No redaction needed — metadata-only entity
- Uniqueness constraint: `(organizationId, entityType, fieldName)`
- `fieldType` must be a valid `CustomFieldType` union member
- Do NOT add schema-apply, promoted-column DDL, or write enforcement in this module
- Full CRUD will be added in the schema-engine milestone, not here
```

- [ ] **Step 2: Create AGENTS.MD for audit-logs**

```markdown
# Audit Logs

Read-only admin/system service for persisted audit records. Exposed as `system.auditLogs`.

- `before` and `after` fields are REDACTED in admin reads (may contain sensitive entity snapshots)
- `actorUserId` and `actorApiKeyId` must resolve in the same tenant when present
- Do NOT add automatic "write an audit row on every mutation" behavior — that is a later middleware milestone
- The internal repository `create` method exists for test fixtures and future audit middleware only
```

- [ ] **Step 3: Create AGENTS.MD for schema-migrations**

```markdown
# Schema Migrations

Read-only admin/system service for schema-migration metadata. Exposed as `system.schemaMigrations`.

- No redaction — SQL statements are operational metadata, not user secrets
- `appliedByUserId` and `approvedByUserId` must resolve in the same tenant when present
- Do NOT expose apply, approve, rollback, preview, or any schema-execution behavior from this module
- The schema-engine milestone owns migration authority — this module is metadata visibility only
```

- [ ] **Step 4: Create AGENTS.MD for idempotency-keys**

```markdown
# Idempotency Keys

Read-only admin/system service for idempotency metadata. Exposed as `system.idempotencyKeys`.

- `requestHash` and `responseBody` are REDACTED in admin reads (may contain replay material or cached responses)
- Uniqueness constraint: `(organizationId, key, method, path)`
- Do NOT add idempotency cache lookup, body-hash conflict detection, lock leasing, or replay behavior
- The idempotency middleware milestone owns those behaviors — this module is metadata visibility only
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/entities/custom-field-definitions/AGENTS.MD
git add packages/core/src/entities/audit-logs/AGENTS.MD
git add packages/core/src/entities/schema-migrations/AGENTS.MD
git add packages/core/src/entities/idempotency-keys/AGENTS.MD
git commit -m "docs(core): add AGENTS.MD files for Slice E entities"
```

---

### Task 25: Run full validation gates and finalize

- [ ] **Step 1: Run all validation gates**

```bash
pnpm --filter @orbit-ai/core test
pnpm --filter @orbit-ai/core typecheck
pnpm --filter @orbit-ai/core build
git diff --check
```

All four must pass with zero failures and no whitespace errors.

- [ ] **Step 2: Update KB.md**

Add to the Decision Log section of `docs/KB.md`:

```markdown
- 2026-04-02: Executed Core Wave 2 Slice E on branch `core-wave-2-slice-e`, covering `system.customFieldDefinitions`, `system.auditLogs`, `system.schemaMigrations`, `system.idempotencyKeys`, final Wave 2 registry wiring, adapter bootstrap for all four entities, and SQLite/Postgres persistence proofs. `auditLogs.before/after` and `idempotencyKeys.requestHash/responseBody` are redacted in admin reads. No audit middleware, idempotency middleware, or schema-engine execution was pulled forward.
```

Update the "Current focus" section to reflect Slice E completion and update the "What Is Next" section.

- [ ] **Step 3: Commit documentation updates**

```bash
git add docs/KB.md
git commit -m "docs(core): update KB for Slice E completion"
```

---

## Post-Implementation Review

### Task 26: Run code review

After all implementation tasks complete and the full suite passes, run the `orbit-core-slice-review` skill and independently the `feature-dev:code-reviewer` agent against the integrated branch.

Focus areas per the plan:
- Contract drift against the accepted Wave 2 plan
- Missing registry or export wiring
- Wrong service-surface width (no CRUD exposed under `system.*`)
- Missing sanitization for audit or idempotency reads
- Missing SQLite/Postgres proof coverage

### Task 27: Run security review

Run the `orbit-tenant-safety-review` skill against the integrated branch.

Mandatory review surfaces:
- Tenant-scoped repositories for all four Slice E entities
- Admin/system services for all four entities
- Sanitization helpers for audit and idempotency DTOs
- Final registry and export wiring
- Adapter bootstrap additions

Threat-model focus: T1 cross-tenant, T2 privileged misuse, T3 secret leakage, T6 schema-evolution exposure

### Task 28: Create Slice E review artifact

Create `docs/review/core-wave-2-slice-e-review.md` documenting:
- What was delivered vs the plan
- Test count delta
- Sanitization decisions made
- Any carry-forwards identified
- Review pass/fail status

---

## Sanitization Decision Summary

| Entity | Redacted Fields | Reason |
|--------|----------------|--------|
| customFieldDefinitions | none | Metadata-only, no sensitive data |
| auditLogs | `before`, `after` | May contain sensitive entity snapshots |
| schemaMigrations | none | SQL statements are operational metadata |
| idempotencyKeys | `requestHash`, `responseBody` | May contain replay material or cached responses |

This decision is documented in the entity AGENTS.MD files and enforced by the sanitized DTOs in validators.ts.

## Known Out-of-Scope Items (Not Bugs)

| Item | Why Out of Scope | Where It's Tracked |
|------|-----------------|-------------------|
| `SchemaSnapshot.customFields` adapter wiring | Schema-engine milestone, not metadata visibility | Plan section 4 |
| Automatic audit-log writes on every mutation | Audit middleware milestone | Plan section 4, spec 01-core.md:1577 |
| Idempotency cache lookup / replay / locking | Idempotency middleware milestone | Plan section 4, spec 01-core.md:1569 |
| `CustomFieldDefinition` type (optional) vs record (nullable) alignment | Schema-engine milestone normalization | Codex review finding #5 |

These are explicitly documented as future milestones in the execution plan sections 2 and 4. They must not be pulled forward into Slice E.
