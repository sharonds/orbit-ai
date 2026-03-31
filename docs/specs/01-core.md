# Spec 1: `@orbit-ai/core`

*Note: Part 1 (sections 1-8) has not been written yet. This file currently contains Part 2 only (sections 9-15). Part 1 covers: package overview, directory layout, storage adapter interface, Drizzle schema definitions, ID generation, Zod validation, RLS generation, and the shared types module.*

---

## 9. Schema Engine (The Moat)

The schema engine is the primary differentiator of Orbit AI. It allows agents and developers to extend the CRM schema at runtime — adding fields to existing entities, creating entirely new entities, and promoting JSONB fields to real columns — without writing raw SQL and without risking data loss.

### 9.1 Interface

```typescript
import type { FieldDefinition, EntityType, SchemaOperation, MigrationResult, SchemaDescription, Migration } from '@orbit-ai/core/types'

interface SchemaEngine {
  // Add a custom field to an entity at runtime
  addField(entityType: EntityType, field: FieldDefinition): Promise<MigrationResult>

  // Add entirely new entity (creates table + RLS + types + API routes)
  addEntity(name: string, fields: FieldDefinition[]): Promise<MigrationResult>

  // Promote a JSONB custom_fields entry to a real database column
  promoteField(entityType: EntityType, fieldName: string): Promise<MigrationResult>

  // Generate migration SQL without applying it
  preview(operation: SchemaOperation): Promise<{ sql: string[], warnings: string[] }>

  // Apply pending migrations
  apply(options?: { dryRun?: boolean, force?: boolean }): Promise<MigrationResult>

  // Rollback last N migrations (default: 1)
  rollback(count?: number): Promise<MigrationResult>

  // Get current schema state for one or all entities
  describe(entityType?: EntityType): Promise<SchemaDescription>

  // List migration history for the current organization
  history(): Promise<Migration[]>
}
```

### 9.2 Supporting Types

```typescript
type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'multi_select' | 'url' | 'email' | 'phone' | 'currency' | 'relation'

interface FieldDefinition {
  name: string                        // snake_case, e.g. "wedding_date"
  type: FieldType
  label?: string                      // Human-readable, e.g. "Wedding Date"
  required?: boolean                  // Default: false
  defaultValue?: unknown
  options?: string[]                  // For select / multi_select types
  relatedEntity?: EntityType          // For relation type
  validation?: Record<string, unknown> // JSON Schema fragment for extra validation
}

type EntityType =
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'activities'
  | 'tasks'
  | 'notes'
  | 'products'
  | 'payments'
  | 'contracts'
  | 'sequences'
  | 'pipelines'
  | 'stages'
  | 'tags'
  | string // custom entity names added via addEntity()

interface MigrationResult {
  success: boolean
  migrationId: string                 // e.g. "20260401_120000_add_field_contacts_wedding_date"
  appliedAt: Date | null              // null when dryRun: true
  sql: string[]                       // SQL statements that were (or would be) executed
  warnings: string[]                  // Non-fatal issues (e.g. index recommendation)
  errors: string[]                    // Populated when success: false
  rollbackSql: string[]               // SQL to undo this migration
  typesRegenerated: boolean
}

type SchemaOperationType = 'add_field' | 'add_entity' | 'promote_field' | 'rename_field' | 'drop_field' | 'drop_entity'

interface SchemaOperation {
  type: SchemaOperationType
  entityType?: EntityType
  entityName?: string
  field?: FieldDefinition
  fieldName?: string
}

interface SchemaDescription {
  entityType: EntityType
  tableName: string                   // e.g. "crm_app.contacts"
  columns: ColumnDescription[]
  customFields: FieldDefinition[]
  indexes: IndexDescription[]
  rlsPolicies: RlsPolicyDescription[]
}

interface ColumnDescription {
  name: string
  type: string                        // Postgres type string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  isForeignKey: boolean
  references?: { table: string, column: string }
}

interface Migration {
  id: string
  appliedAt: Date
  description: string
  entityType: EntityType | null
  operationType: SchemaOperationType
  sql: string[]
  rollbackSql: string[]
  appliedBy: string | null            // user_id or 'system'
}
```

### 9.3 How `addField` Works (Step by Step)

```typescript
// packages/core/src/schema-engine/add-field.ts

import { db } from '../db'
import { fieldDefinitions, schemaMigrations } from '../drizzle/schema'
import { validateFieldDefinition } from './validate'
import { generateFieldSql } from './sql-gen'
import { regenerateZodSchema } from './type-gen'
import { generateMigrationId } from '../utils/ids'
import { eq, and } from 'drizzle-orm'
import type { FieldDefinition, EntityType, MigrationResult } from '@orbit-ai/core/types'

export async function addField(
  entityType: EntityType,
  field: FieldDefinition,
  context: OrbitContext
): Promise<MigrationResult> {
  const migrationId = generateMigrationId('add_field', entityType, field.name)

  // Step 1: Validate the field definition
  const validationErrors = validateFieldDefinition(field)
  if (validationErrors.length > 0) {
    return {
      success: false,
      migrationId,
      appliedAt: null,
      sql: [],
      warnings: [],
      errors: validationErrors,
      rollbackSql: [],
      typesRegenerated: false
    }
  }

  // Step 2: Check for name collision in field_definitions for this entity + org
  const existing = await db
    .select()
    .from(fieldDefinitions)
    .where(
      and(
        eq(fieldDefinitions.entityType, entityType),
        eq(fieldDefinitions.fieldName, field.name),
        eq(fieldDefinitions.organizationId, context.organizationId)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return {
      success: false,
      migrationId,
      appliedAt: null,
      sql: [],
      warnings: [],
      errors: [`Field "${field.name}" already exists on entity "${entityType}"`],
      rollbackSql: [],
      typesRegenerated: false
    }
  }

  // Step 3: Insert the field_definition row (this registers the field in the
  // JSONB registry — the field is immediately available as a typed custom field
  // stored in the entity's custom_fields JSONB column)
  await db.insert(fieldDefinitions).values({
    id: generateId('field'),
    organizationId: context.organizationId,
    entityType,
    fieldName: field.name,
    fieldType: field.type,
    label: field.label ?? field.name,
    required: field.required ?? false,
    defaultValue: field.defaultValue ?? null,
    options: field.options ?? null,
    relatedEntity: field.relatedEntity ?? null,
    validation: field.validation ?? null,
    isPromoted: false,                // not a real column yet
    createdAt: new Date()
  })

  // Step 4: Update JSONB validation — rebuild the JSON Schema for custom_fields
  // on this entity so that required fields and option constraints are enforced
  const updatedSchema = await buildJsonSchema(entityType, context.organizationId)
  await setCustomFieldsJsonSchema(entityType, updatedSchema)

  // Step 5: Generate the Zod schema for this entity (includes custom fields)
  // and write it to packages/core/src/generated/{entityType}.custom.ts
  const typesRegenerated = await regenerateZodSchema(entityType, context.organizationId)

  // Step 6: Log the migration
  const appliedAt = new Date()
  await db.insert(schemaMigrations).values({
    id: migrationId,
    organizationId: context.organizationId,
    appliedAt,
    description: `Add field "${field.name}" (${field.type}) to ${entityType}`,
    entityType,
    operationType: 'add_field',
    sql: [],                          // no DDL for JSONB-backed field
    rollbackSql: [],
    appliedBy: context.userId
  })

  return {
    success: true,
    migrationId,
    appliedAt,
    sql: [],
    warnings: [],
    errors: [],
    rollbackSql: [],
    typesRegenerated
  }
}
```

### 9.4 How `addEntity` Works (Step by Step)

```typescript
// packages/core/src/schema-engine/add-entity.ts

import { generateTableSql, generateRlsSql } from './sql-gen'
import { generateDrizzleDefinition } from './drizzle-gen'
import { generateTypeFile } from './type-gen'
import type { FieldDefinition, MigrationResult } from '@orbit-ai/core/types'

export async function addEntity(
  name: string,
  fields: FieldDefinition[],
  context: OrbitContext
): Promise<MigrationResult> {
  const migrationId = generateMigrationId('add_entity', name)
  const warnings: string[] = []

  // Step 1: Validate entity name (snake_case, no reserved words, no collision)
  const nameErrors = validateEntityName(name)
  if (nameErrors.length > 0) {
    return { success: false, migrationId, appliedAt: null, sql: [], warnings, errors: nameErrors, rollbackSql: [], typesRegenerated: false }
  }

  // Step 2: Generate Drizzle table definition (in-memory, not written to disk yet)
  const drizzleTable = generateDrizzleDefinition(name, fields)
  // Always includes: id, organization_id, created_at, updated_at, custom_fields

  // Step 3: Generate migration SQL
  // e.g. CREATE TABLE crm_app.{name} (id TEXT PRIMARY KEY, organization_id UUID NOT NULL, ...)
  const sql = generateTableSql(name, fields, { schema: 'crm_app' })

  // Step 4: Generate RLS policies
  // - Enable RLS on the table
  // - SELECT/INSERT/UPDATE/DELETE policies using get_my_org_id()
  const rlsSql = generateRlsSql(name, { mode: context.tenancyMode })
  const allSql = [...sql, ...rlsSql]

  // Step 5: Check for dry-run
  if (context.dryRun) {
    return {
      success: true,
      migrationId,
      appliedAt: null,
      sql: allSql,
      warnings,
      errors: [],
      rollbackSql: generateDropTableSql(name),
      typesRegenerated: false
    }
  }

  // Step 6: Apply the SQL (on Neon: branch first, then apply)
  if (context.adapter === 'neon') {
    await neonBranchBeforeMigrate(migrationId)
    warnings.push('Neon branch created before migration. Review and merge at console.neon.tech.')
  }

  for (const statement of allSql) {
    await context.raw(statement)
  }

  // Step 7: Generate TypeScript types file
  // Writes packages/core/src/generated/entities/{name}.ts
  await generateTypeFile(name, fields)

  // Step 8: Register entity in the entity registry
  await registerCustomEntity(name, context.organizationId)

  // Step 9: Log migration
  const appliedAt = new Date()
  await db.insert(schemaMigrations).values({
    id: migrationId,
    organizationId: context.organizationId,
    appliedAt,
    description: `Add entity "${name}" with ${fields.length} fields`,
    entityType: name,
    operationType: 'add_entity',
    sql: allSql,
    rollbackSql: generateDropTableSql(name),
    appliedBy: context.userId
  })

  return {
    success: true,
    migrationId,
    appliedAt,
    sql: allSql,
    warnings,
    errors: [],
    rollbackSql: generateDropTableSql(name),
    typesRegenerated: true
  }
}
```

### 9.5 Safety Guardrails

**Non-destructive by default.** Agents cannot execute DROP TABLE, DROP COLUMN, or ALTER COLUMN TYPE without explicit opt-in:

```typescript
// DROP TABLE requires { destructive: true } AND human approval in production
await schema.apply({ force: true }) // still blocked on 'production' environment

// Only allowed when:
// 1. context.environment !== 'production', OR
// 2. ORBIT_ALLOW_DESTRUCTIVE=true env var is set, OR
// 3. human approval has been recorded (via orbit migrate --approve <id>)

function guardDestructive(operation: SchemaOperation, context: OrbitContext): void {
  const isDestructive = ['drop_field', 'drop_entity'].includes(operation.type)
    || (operation.type === 'rename_field')  // rename = drop + add in SQLite

  if (isDestructive && context.environment === 'production') {
    if (!context.destructiveApproved) {
      throw new OrbitError({
        code: 'SCHEMA_DESTRUCTIVE_BLOCKED',
        message: `Operation "${operation.type}" is destructive and blocked in production.`,
        hint: 'Run `orbit migrate --approve ${migrationId}` to unlock, or set ORBIT_ALLOW_DESTRUCTIVE=true.',
        recovery: 'Use promoteField() or addField() instead of dropping columns.'
      })
    }
  }
}
```

**Branch-before-migrate on Neon.** When the storage adapter is Neon, every schema migration first creates a Neon branch:

```typescript
// packages/core/src/adapters/neon/branch.ts
export async function neonBranchBeforeMigrate(migrationId: string): Promise<string> {
  const branchName = `orbit-migration-${migrationId}`
  // Uses Neon Management API to create branch from main
  const branch = await neonApi.createBranch({ name: branchName, parentBranch: 'main' })
  return branch.id
}
```

**Type-checking for incompatible changes.** Before promoting a JSONB field to a column, the engine checks for data incompatibility:

```typescript
// Before ALTER COLUMN: scan existing custom_fields values for type violations
async function checkTypeCompatibility(
  entityType: EntityType,
  fieldName: string,
  targetType: FieldType
): Promise<string[]> {
  const violations = await db.execute(sql`
    SELECT id, custom_fields->>${fieldName} AS val
    FROM crm_app.${sql.identifier(entityType)}
    WHERE custom_fields->>${fieldName} IS NOT NULL
      AND NOT (custom_fields->>${fieldName} ~ ${typePattern(targetType)})
    LIMIT 10
  `)
  return violations.rows.map(r => `Row ${r.id}: value "${r.val}" is not a valid ${targetType}`)
}
```

**Human approval gate for production.** The CLI `orbit migrate` command requires explicit confirmation for any DDL in a production environment. The approval is recorded with a signature in `schema_migrations` before the SQL runs.

### 9.6 Migration File Format and Storage

Migrations are stored in two places simultaneously:

1. **Database table** `crm_app.schema_migrations` — canonical record, queryable, org-scoped
2. **Filesystem** `{project}/.orbit/migrations/` — human-readable, git-committable

```
.orbit/migrations/
  20260401_120000_add_field_contacts_wedding_date.json
  20260402_083000_add_entity_event_notes.json
  20260403_140500_promote_field_contacts_lead_score.json
```

Migration file format:

```json
{
  "id": "20260401_120000_add_field_contacts_wedding_date",
  "description": "Add field \"wedding_date\" (date) to contacts",
  "entityType": "contacts",
  "operationType": "add_field",
  "appliedAt": "2026-04-01T12:00:00.000Z",
  "appliedBy": "user_01HX123",
  "sql": [],
  "rollbackSql": [],
  "fieldDefinition": {
    "name": "wedding_date",
    "type": "date",
    "label": "Wedding Date",
    "required": false
  }
}
```

### 9.7 TypeScript Type Regeneration

After any schema change, types are regenerated via `regenerateZodSchema()`:

```typescript
// packages/core/src/schema-engine/type-gen.ts
import { createSelectSchema, createInsertSchema } from 'drizzle-zod'
import { contacts } from '../drizzle/schema'
import type { FieldDefinition } from '@orbit-ai/core/types'

export async function regenerateZodSchema(
  entityType: EntityType,
  organizationId: string
): Promise<boolean> {
  // 1. Load all field_definitions for this entity + org
  const customFields = await loadFieldDefinitions(entityType, organizationId)

  // 2. Build Zod extension for custom_fields
  const customFieldsZod = buildCustomFieldsZod(customFields)

  // 3. Extend the base Drizzle-generated schema
  const baseSelect = createSelectSchema(getTable(entityType))
  const extended = baseSelect.extend({
    custom_fields: customFieldsZod
  })

  // 4. Write generated file (for SDK and API type exports)
  const code = generateZodFileContent(entityType, extended, customFields)
  await writeFile(
    `packages/core/src/generated/${entityType}.zod.ts`,
    code
  )

  return true
}

function buildCustomFieldsZod(fields: FieldDefinition[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {}
  for (const field of fields) {
    shape[field.name] = fieldTypeToZod(field)
  }
  return z.object(shape).passthrough()
}

function fieldTypeToZod(field: FieldDefinition): z.ZodTypeAny {
  const base: Record<FieldType, z.ZodTypeAny> = {
    text: z.string(),
    number: z.number(),
    boolean: z.boolean(),
    date: z.string().date(),
    datetime: z.string().datetime(),
    select: field.options ? z.enum(field.options as [string, ...string[]]) : z.string(),
    multi_select: field.options ? z.array(z.enum(field.options as [string, ...string[]])) : z.array(z.string()),
    url: z.string().url(),
    email: z.string().email(),
    phone: z.string(),
    currency: z.number().nonnegative(),
    relation: z.string()             // stores the related entity ID
  }
  const zodType = base[field.type] ?? z.unknown()
  return field.required ? zodType : zodType.nullable().optional()
}
```

---

## 10. Entity Operations (CRUD)

Every entity exposed by Orbit AI is accessed through a uniform `EntityOperations<T>` interface. The underlying implementation uses Drizzle query builders and injects `organization_id` automatically from the `OrbitContext`.

### 10.1 Interface

```typescript
import type { Filter, SortOptions, ListOptions, SearchQuery, PaginatedResult } from '@orbit-ai/core/types'

interface EntityOperations<T, TInsert = Partial<T>> {
  create(data: TInsert): Promise<T>
  get(id: string): Promise<T | null>
  update(id: string, data: Partial<TInsert>): Promise<T>
  delete(id: string): Promise<void>
  list(options?: ListOptions<T>): Promise<PaginatedResult<T>>
  search(query: SearchQuery): Promise<PaginatedResult<T>>
  count(filters?: Filter[]): Promise<number>
}
```

### 10.2 `ListOptions` Type

```typescript
interface ListOptions<T = unknown> {
  filters?: Filter[]
  sort?: SortOptions[]
  limit?: number                      // Default: 25, max: 100
  cursor?: string                     // Opaque cursor from previous response
  include?: RelationshipKey[]         // Relationships to load (e.g. ['company', 'deals'])
}

type FilterOperator =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike'
  | 'in' | 'not_in'
  | 'is_null' | 'is_not_null'
  | 'contains'                        // for JSONB arrays

interface Filter {
  field: string
  op: FilterOperator
  value?: unknown                     // absent for is_null / is_not_null
}

interface SortOptions {
  field: string
  direction: 'asc' | 'desc'
}

type RelationshipKey = 'company' | 'deals' | 'activities' | 'tasks' | 'notes' | 'tags' | 'recent_activities' | string
```

### 10.3 Filter to Drizzle Mapping

```typescript
// packages/core/src/entity/filters.ts
import { eq, ne, gt, gte, lt, lte, like, ilike, inArray, notInArray, isNull, isNotNull, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

function applyFilter(column: AnyPgColumn, filter: Filter): SQL {
  const { op, value } = filter
  switch (op) {
    case 'eq':         return eq(column, value)
    case 'neq':        return ne(column, value)
    case 'gt':         return gt(column, value)
    case 'gte':        return gte(column, value)
    case 'lt':         return lt(column, value)
    case 'lte':        return lte(column, value)
    case 'like':       return like(column, escapeLike(String(value)))
    case 'ilike':      return ilike(column, escapeLike(String(value)))
    case 'in':         return inArray(column, value as unknown[])
    case 'not_in':     return notInArray(column, value as unknown[])
    case 'is_null':    return isNull(column)
    case 'is_not_null':return isNotNull(column)
    case 'contains':   return sql`${column} @> ${JSON.stringify(value)}`
    default:
      throw new OrbitError({ code: 'INVALID_FILTER_OP', message: `Unknown filter operator: ${op}` })
  }
}

// Always escape user input before passing to LIKE/ILIKE
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`)
}
```

### 10.4 Relationship Loading

```typescript
// include: ['company', 'deals', 'recent_activities']
// Relationship loading is eager, not lazy — N relations = N additional queries,
// batched after the main list query to avoid N+1 per row.

async function loadRelationships<T extends { id: string }>(
  rows: T[],
  include: RelationshipKey[],
  context: OrbitContext
): Promise<T[]> {
  if (include.length === 0 || rows.length === 0) return rows

  const ids = rows.map(r => r.id)
  const loaded: Record<string, Record<RelationshipKey, unknown>> = {}

  // Batch-load each requested relationship
  await Promise.all(include.map(async (rel) => {
    switch (rel) {
      case 'company': {
        const companyIds = [...new Set(
          (rows as Array<{ company_id?: string | null }>)
            .map(r => r.company_id)
            .filter(Boolean) as string[]
        )]
        if (companyIds.length === 0) return
        const companies = await db
          .select()
          .from(companiesTable)
          .where(
            and(
              inArray(companiesTable.id, companyIds),
              eq(companiesTable.organizationId, context.organizationId)
            )
          )
        const byId = Object.fromEntries(companies.map(c => [c.id, c]))
        for (const row of rows) {
          const r = row as Record<string, unknown>
          loaded[r.id as string] ??= {} as Record<RelationshipKey, unknown>
          loaded[r.id as string].company = byId[r.company_id as string] ?? null
        }
        break
      }

      case 'recent_activities': {
        // Load last 10 activities per contact in a single IN query + client-side grouping
        const activities = await db
          .select()
          .from(activitiesTable)
          .where(
            and(
              inArray(activitiesTable.contactId, ids),
              eq(activitiesTable.organizationId, context.organizationId)
            )
          )
          .orderBy(desc(activitiesTable.occurredAt))
          .limit(ids.length * 10)     // over-fetch, group client-side
        const byContactId = groupBy(activities, a => a.contactId)
        for (const id of ids) {
          loaded[id] ??= {} as Record<RelationshipKey, unknown>
          loaded[id].recent_activities = (byContactId[id] ?? []).slice(0, 10)
        }
        break
      }

      case 'deals': {
        const deals = await db
          .select()
          .from(dealsTable)
          .where(
            and(
              inArray(dealsTable.contactId, ids),
              eq(dealsTable.organizationId, context.organizationId)
            )
          )
        const byContactId = groupBy(deals, d => d.contactId)
        for (const id of ids) {
          loaded[id] ??= {} as Record<RelationshipKey, unknown>
          loaded[id].deals = byContactId[id] ?? []
        }
        break
      }

      // ... tags, tasks, notes follow the same pattern
    }
  }))

  // Merge loaded relationships back into rows
  return rows.map(row => ({
    ...row,
    ...loaded[(row as Record<string, unknown>).id as string]
  }))
}
```

### 10.5 Cursor-Based Pagination

```typescript
// packages/core/src/entity/pagination.ts

interface CursorPayload {
  id: string
  createdAt: string                   // ISO 8601
}

function encodeCursor(row: { id: string, createdAt: Date }): string {
  const payload: CursorPayload = { id: row.id, createdAt: row.createdAt.toISOString() }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as CursorPayload
  } catch {
    throw new OrbitError({ code: 'INVALID_CURSOR', message: 'Cursor is malformed or expired.' })
  }
}

// In list() implementation: fetch limit + 1 rows to determine has_more
async function buildPaginatedResult<T extends { id: string, createdAt: Date }>(
  rows: T[],
  limit: number
): Promise<PaginatedResult<T>> {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const lastRow = data[data.length - 1]
  return {
    data,
    meta: {
      cursor: lastRow ? encodeCursor(lastRow) : null,
      has_more: hasMore,
      count: data.length
    }
  }
}

// Cursor used as WHERE clause: (created_at, id) < (cursor.createdAt, cursor.id)
// This gives stable pagination even when new rows are inserted during paging.
function applyCursorWhere(cursor: CursorPayload): SQL {
  return sql`(created_at, id) < (${cursor.createdAt}::timestamptz, ${cursor.id})`
}
```

### 10.6 Custom Fields Merging

Custom fields are stored in the `custom_fields JSONB` column and are transparently merged into the entity response. No special handling needed by callers.

```typescript
// The Drizzle select already includes custom_fields as a column.
// The Zod schema (regenerated by schema engine) validates and types it.
// At the API response layer, custom_fields is spread into the response object
// so callers see: { id, name, email, ..., wedding_date: "2026-06-15" }
// rather than: { id, name, email, ..., custom_fields: { wedding_date: "2026-06-15" } }

function flattenCustomFields<T extends { custom_fields?: Record<string, unknown> | null }>(
  row: T
): Omit<T, 'custom_fields'> & Record<string, unknown> {
  const { custom_fields, ...rest } = row
  return { ...rest, ...(custom_fields ?? {}) }
}
```

### 10.7 Automatic Audit Logging and `organization_id` Injection

Every `create()`, `update()`, and `delete()` call on any entity automatically:

1. Injects `organization_id` from `OrbitContext` — callers never pass it manually
2. Writes a row to `crm_app.audit_log` with the before/after snapshot

```typescript
// packages/core/src/entity/base.ts

export function createEntityOperations<T extends BaseEntity, TInsert>(
  table: PgTable,
  entityType: EntityType,
  context: OrbitContext
): EntityOperations<T, TInsert> {
  return {
    async create(data: TInsert): Promise<T> {
      const id = generateId(entityType)
      const row = await db
        .insert(table)
        .values({
          ...data,
          id,
          organization_id: context.organizationId,  // always injected
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning()
        .then(rows => rows[0] as T)

      await writeAuditLog({
        entityType,
        entityId: id,
        action: 'create',
        before: null,
        after: row,
        userId: context.userId,
        organizationId: context.organizationId
      })

      return row
    },

    async update(id: string, data: Partial<TInsert>): Promise<T> {
      const before = await this.get(id)
      if (!before) {
        throw new OrbitError({ code: 'NOT_FOUND', message: `${entityType} ${id} not found` })
      }

      const after = await db
        .update(table)
        .set({ ...data, updated_at: new Date() })
        .where(
          and(
            eq((table as Record<string, AnyPgColumn>).id, id),
            eq((table as Record<string, AnyPgColumn>).organization_id, context.organizationId)
          )
        )
        .returning()
        .then(rows => rows[0] as T)

      await writeAuditLog({
        entityType,
        entityId: id,
        action: 'update',
        before,
        after,
        userId: context.userId,
        organizationId: context.organizationId
      })

      return after
    },

    async delete(id: string): Promise<void> {
      const before = await this.get(id)
      if (!before) {
        throw new OrbitError({ code: 'NOT_FOUND', message: `${entityType} ${id} not found` })
      }

      await db
        .delete(table)
        .where(
          and(
            eq((table as Record<string, AnyPgColumn>).id, id),
            eq((table as Record<string, AnyPgColumn>).organization_id, context.organizationId)
          )
        )

      await writeAuditLog({
        entityType,
        entityId: id,
        action: 'delete',
        before,
        after: null,
        userId: context.userId,
        organizationId: context.organizationId
      })
    },

    // list() and search() always add .where(eq(table.organization_id, context.organizationId))
    async list(options?: ListOptions<T>): Promise<PaginatedResult<T>> {
      const limit = Math.min(options?.limit ?? 25, 100)
      const filters = options?.filters ?? []
      const sorts = options?.sort ?? [{ field: 'created_at', direction: 'desc' }]

      let query = db.select().from(table)
        .where(
          and(
            eq((table as Record<string, AnyPgColumn>).organization_id, context.organizationId),
            options?.cursor ? applyCursorWhere(decodeCursor(options.cursor)) : undefined,
            ...filters.map(f => applyFilter((table as Record<string, AnyPgColumn>)[f.field], f))
          )
        )
        .orderBy(...sorts.map(s =>
          s.direction === 'asc'
            ? asc((table as Record<string, AnyPgColumn>)[s.field])
            : desc((table as Record<string, AnyPgColumn>)[s.field])
        ))
        .limit(limit + 1)

      const rows = await query as T[]
      const paged = await buildPaginatedResult(rows, limit)

      if (options?.include?.length) {
        paged.data = await loadRelationships(paged.data, options.include, context)
      }

      return paged
    }
  }
}
```

---

## 11. Audit Logging

### 11.1 `audit_log` Table Schema

```typescript
// packages/core/src/drizzle/schema/audit-log.ts
import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

export const auditLog = pgTable('audit_log', {
  id:             text('id').primaryKey(),        // ulid prefixed: "audit_01HX..."
  organizationId: text('organization_id').notNull(),
  entityType:     text('entity_type').notNull(),   // 'contacts', 'deals', etc.
  entityId:       text('entity_id').notNull(),
  action:         text('action').notNull(),         // 'create' | 'update' | 'delete'
  before:         jsonb('before'),                  // null on create
  after:          jsonb('after'),                   // null on delete
  changes:        text('changes').array(),          // field names that changed (update only)
  userId:         text('user_id'),                  // null for system/agent operations
  userEmail:      text('user_email'),               // denormalized for readability
  ipAddress:      text('ip_address'),               // from request context if available
  userAgent:      text('user_agent'),
  requestId:      text('request_id'),               // correlates to API request
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index('audit_log_entity_idx').on(t.entityType, t.entityId),
  index('audit_log_org_idx').on(t.organizationId, t.createdAt.desc()),
  index('audit_log_user_idx').on(t.userId)
])
```

### 11.2 Auto-Logging Implementation

Every mutation routed through `EntityOperations.create()`, `update()`, or `delete()` calls `writeAuditLog()` internally. Callers never invoke it directly.

```typescript
// packages/core/src/audit/write.ts

interface AuditEntry {
  entityType: EntityType
  entityId: string
  action: 'create' | 'update' | 'delete'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  userId: string | null
  organizationId: string
  requestId?: string
}

async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const changes = computeChanges(entry.before, entry.after)

  await db.insert(auditLog).values({
    id: generateId('audit'),
    organizationId: entry.organizationId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before,
    after: entry.after,
    changes,
    userId: entry.userId,             // null is valid for system/AI actions
    requestId: entry.requestId ?? null,
    createdAt: new Date()
  })
}
```

### 11.3 Before/After Diff

```typescript
// packages/core/src/audit/diff.ts

function computeChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string[] {
  if (!before || !after) return []    // create or delete — no field diff

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []

  for (const key of allKeys) {
    if (key === 'updated_at') continue  // always changes, not meaningful
    if (!deepEqual(before[key], after[key])) {
      changed.push(key)
    }
  }

  return changed.sort()
}
```

### 11.4 `getAuditHistory()`

```typescript
// packages/core/src/audit/query.ts

async function getAuditHistory(
  entityType: EntityType,
  entityId: string,
  context: OrbitContext,
  options?: { limit?: number, cursor?: string }
): Promise<PaginatedResult<typeof auditLog.$inferSelect>> {
  const limit = options?.limit ?? 50
  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.organizationId, context.organizationId),
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId),
        options?.cursor ? applyCursorWhere(decodeCursor(options.cursor)) : undefined
      )
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit + 1)

  return buildPaginatedResult(rows, limit)
}
```

### 11.5 `undoAction()`

Reverses a specific audit log entry by replaying the `before` snapshot. Only works for `update` actions (cannot un-delete or un-create without data loss risks).

```typescript
// packages/core/src/audit/undo.ts

async function undoAction(
  auditId: string,
  context: OrbitContext
): Promise<{ success: boolean, restoredEntity: unknown }> {
  const entry = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.id, auditId),
        eq(auditLog.organizationId, context.organizationId)
      )
    )
    .limit(1)
    .then(rows => rows[0])

  if (!entry) {
    throw new OrbitError({ code: 'NOT_FOUND', message: `Audit entry ${auditId} not found` })
  }

  if (entry.action !== 'update') {
    throw new OrbitError({
      code: 'UNDO_NOT_SUPPORTED',
      message: `Cannot undo action "${entry.action}". Only "update" actions are reversible.`,
      hint: 'Use create() or delete() manually to reverse creates and deletes.',
      recovery: null
    })
  }

  if (!entry.before) {
    throw new OrbitError({ code: 'UNDO_NO_SNAPSHOT', message: 'Before snapshot is missing from this audit entry.' })
  }

  // Restore using the entity operations layer (which will itself write a new audit entry)
  const ops = createEntityOperations(
    getTable(entry.entityType as EntityType),
    entry.entityType as EntityType,
    context
  )

  const restored = await ops.update(entry.entityId, entry.before as Record<string, unknown>)

  return { success: true, restoredEntity: restored }
}
```

---

## 12. `getContactContext()`

The "pre-flight briefing" function — returns a full dossier on a contact in a single function call. Used by `orbit context <email>` in the CLI and as a building block for MCP agents.

### 12.1 Return Type

```typescript
interface ContactContext {
  contact: Contact
  company: Company | null
  deals: Deal[]                       // open (not won, not lost) deals only
  recentActivities: Activity[]        // last 10, ordered by occurred_at desc
  openTasks: Task[]                   // is_completed = false, ordered by due_date asc
  tags: Tag[]
  lastContactDate: Date | null        // most recent activity.occurred_at
  stats: {
    totalDeals: number
    totalValue: number                // sum of deal.value across ALL deals
    wonDeals: number
    lostDeals: number
    winRate: number                   // wonDeals / (wonDeals + lostDeals), 0 if no closed deals
    avgDealValue: number              // totalValue / totalDeals, 0 if no deals
  }
}
```

### 12.2 Implementation

```typescript
// packages/core/src/context/contact-context.ts
import { db } from '../db'
import { contacts, companies, deals, activities, tasks, tags, entityTags, stages } from '../drizzle/schema'
import { eq, and, isNull, desc, asc, inArray, sum, count } from 'drizzle-orm'
import type { OrbitContext } from '@orbit-ai/core/types'

export async function getContactContext(
  idOrEmail: string,
  context: OrbitContext
): Promise<ContactContext> {
  const orgId = context.organizationId

  // Step 1: Resolve the contact (by ID or email) — single query
  const isEmail = idOrEmail.includes('@')
  const contact = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, orgId),
        isEmail
          ? eq(contacts.email, idOrEmail)
          : eq(contacts.id, idOrEmail)
      )
    )
    .limit(1)
    .then(rows => rows[0] ?? null)

  if (!contact) {
    throw new OrbitError({
      code: 'NOT_FOUND',
      message: `Contact not found: ${idOrEmail}`,
      hint: 'Check the email address or contact ID.',
      recovery: 'Use orbit contacts search to find the correct identifier.'
    })
  }

  // Steps 2-7: Run all remaining queries in parallel — no N+1
  const [
    company,
    allDeals,
    recentActivities,
    openTasks,
    contactTags,
    dealStats
  ] = await Promise.all([
    // 2. Company (nullable)
    contact.companyId
      ? db.select().from(companies)
          .where(and(eq(companies.id, contact.companyId), eq(companies.organizationId, orgId)))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : Promise.resolve(null),

    // 3. All deals (open + closed, for stats + open deal list)
    db.select({
        id: deals.id,
        title: deals.title,
        value: deals.value,
        stageId: deals.stageId,
        wonAt: deals.wonAt,
        lostAt: deals.lostAt,
        lostReason: deals.lostReason,
        expectedCloseDate: deals.expectedCloseDate,
        assignedTo: deals.assignedTo,
        createdAt: deals.createdAt
      })
      .from(deals)
      .where(and(eq(deals.contactId, contact.id), eq(deals.organizationId, orgId)))
      .orderBy(desc(deals.createdAt)),

    // 4. Recent activities (last 10)
    db.select()
      .from(activities)
      .where(and(eq(activities.contactId, contact.id), eq(activities.organizationId, orgId)))
      .orderBy(desc(activities.occurredAt))
      .limit(10),

    // 5. Open tasks
    db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.contactId, contact.id),
          eq(tasks.organizationId, orgId),
          eq(tasks.isCompleted, false)
        )
      )
      .orderBy(asc(tasks.dueDate)),

    // 6. Tags (via entity_tags join)
    db.select({ tag: tags })
      .from(entityTags)
      .innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(
        and(
          eq(entityTags.entityType, 'contacts'),
          eq(entityTags.entityId, contact.id)
        )
      )
      .then(rows => rows.map(r => r.tag)),

    // 7. Deal aggregates in a single SQL query (avoids loading all deal rows just for stats)
    db.select({
        totalDeals: count(deals.id),
        totalValue: sum(deals.value),
        wonDeals: count(deals.wonAt),
        lostDeals: count(deals.lostAt)
      })
      .from(deals)
      .where(and(eq(deals.contactId, contact.id), eq(deals.organizationId, orgId)))
      .then(rows => rows[0] ?? { totalDeals: 0, totalValue: 0, wonDeals: 0, lostDeals: 0 })
  ])

  // Derive computed fields
  const openDeals = allDeals.filter(d => !d.wonAt && !d.lostAt)
  const lastActivityDate = recentActivities[0]?.occurredAt ?? null
  const wonCount = Number(dealStats.wonDeals)
  const lostCount = Number(dealStats.lostDeals)
  const totalDeals = Number(dealStats.totalDeals)
  const totalValue = Number(dealStats.totalValue ?? 0)

  return {
    contact,
    company,
    deals: openDeals,
    recentActivities,
    openTasks,
    tags: contactTags,
    lastContactDate: lastActivityDate,
    stats: {
      totalDeals,
      totalValue,
      wonDeals: wonCount,
      lostDeals: lostCount,
      winRate: (wonCount + lostCount) > 0 ? wonCount / (wonCount + lostCount) : 0,
      avgDealValue: totalDeals > 0 ? totalValue / totalDeals : 0
    }
  }
}
```

The implementation runs exactly 7 queries total regardless of how many deals, activities, or tasks the contact has. The parallel `Promise.all` means wall-clock time equals the slowest individual query, not their sum.

---

## 13. Full-Text Search

### 13.1 Architecture

Orbit AI uses Postgres `tsvector` columns for full-text search across contacts, companies, deals, and notes. Each searchable entity maintains a `search_vector tsvector` column updated by a database trigger on every insert and update.

### 13.2 `searchAll()` Function

```typescript
// packages/core/src/search/search-all.ts
import { sql } from 'drizzle-orm'
import type { OrbitContext, EntityType } from '@orbit-ai/core/types'

interface SearchResult {
  entityType: EntityType
  id: string
  name: string                        // best display name for the result
  snippet: string                     // headline from ts_headline()
  rank: number                        // ts_rank score
  metadata: Record<string, unknown>   // entity-specific summary fields
}

interface SearchOptions {
  entityTypes?: EntityType[]          // default: all searchable entities
  limit?: number                      // default: 20
}

const SEARCHABLE_ENTITIES: EntityType[] = ['contacts', 'companies', 'deals', 'notes']

export async function searchAll(
  query: string,
  options: SearchOptions = {},
  context: OrbitContext
): Promise<SearchResult[]> {
  const entityTypes = options.entityTypes ?? SEARCHABLE_ENTITIES
  const limit = options.limit ?? 20
  const orgId = context.organizationId

  // Convert raw query to tsquery (plainto_tsquery is safe for user input — no syntax errors)
  // websearch_to_tsquery requires Postgres 11+ and handles "quoted phrases" and -exclusions
  const tsQuery = sql`websearch_to_tsquery('english', ${query})`

  const subqueries = entityTypes.map(entityType => {
    const tableRef = sql.identifier('crm_app', entityType)
    const nameCol = getDisplayNameColumn(entityType)  // 'name' for most, 'title' for deals/notes
    return sql`
      SELECT
        ${entityType} AS entity_type,
        id,
        ${nameCol} AS name,
        ts_headline('english', ${getSearchableText(entityType)}, ${tsQuery},
          'MaxFragments=1,MaxWords=20,MinWords=5') AS snippet,
        ts_rank(search_vector, ${tsQuery}) AS rank,
        ${buildMetadataJson(entityType)} AS metadata
      FROM ${tableRef}
      WHERE organization_id = ${orgId}
        AND search_vector @@ ${tsQuery}
    `
  })

  const unionQuery = sql.join(subqueries, sql` UNION ALL `)
  const results = await db.execute<SearchResult>(
    sql`SELECT * FROM (${unionQuery}) sub ORDER BY rank DESC LIMIT ${limit}`
  )

  return results.rows
}
```

### 13.3 `tsvector` Trigger Maintenance

Each searchable table has a `search_vector` column and a trigger that keeps it current:

```sql
-- Generated by schema engine for each searchable entity
-- contacts example:
ALTER TABLE crm_app.contacts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(phone, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(notes, '')), 'D')
    ) STORED;

CREATE INDEX IF NOT EXISTS contacts_search_vector_idx
  ON crm_app.contacts USING gin(search_vector);

-- deals example:
ALTER TABLE crm_app.deals
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(lost_reason, '')), 'D')
    ) STORED;
```

The `GENERATED ALWAYS AS ... STORED` syntax (Postgres 12+) eliminates the need for a separate trigger — the column is automatically recomputed on every write. The GIN index makes `@@` queries fast even on large tables.

### 13.4 Search Result Ranking

Results are ranked by `ts_rank()` which factors in:
- **Weight classes**: `A` (name/title) ranks higher than `D` (body text)
- **Term frequency**: multiple matches in a document score higher
- **Document length normalization**: configurable via rank option `1` (divide by 1 + log(length))

All results across entity types are merged into a single list sorted by `rank DESC`, so a highly-matching deal name appears above a weakly-matching contact note.

### 13.5 SQLite Fallback

When using the SQLite adapter (local development), `tsvector` is not available. The search falls back to `LIKE`-based matching with reduced performance:

```typescript
// packages/core/src/search/sqlite-search.ts

export async function searchAllSqlite(
  query: string,
  options: SearchOptions,
  context: OrbitContext
): Promise<SearchResult[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  const likePattern = `%${terms.join('%')}%`

  // SQLite: sequential LIKE scan — no ranking, no snippets
  // Performance degrades on > 10,000 rows; acceptable for local dev
  const results: SearchResult[] = []

  if (!options.entityTypes || options.entityTypes.includes('contacts')) {
    const rows = await sqliteDb.all<{ id: string, name: string, email: string }>(
      `SELECT id, name, email FROM contacts
       WHERE organization_id = ?
         AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR notes LIKE ?)
       LIMIT ?`,
      [context.organizationId, likePattern, likePattern, likePattern, likePattern, options.limit ?? 20]
    )
    results.push(...rows.map(r => ({
      entityType: 'contacts' as EntityType,
      id: r.id,
      name: r.name,
      snippet: '',
      rank: 0,
      metadata: { email: r.email }
    })))
  }

  // ... repeat for other entity types

  return results.slice(0, options.limit ?? 20)
}
```

The `orbit doctor` command warns when running on SQLite: `"Full-text search is using LIKE fallback on SQLite. Performance will degrade above 10,000 records. Use --db neon or --db supabase for production workloads."`

---

## 14. Multi-Tenancy

### 14.1 `organization_id` Enforcement

Every table created by the schema engine — both built-in entities and custom entities added via `addEntity()` — includes `organization_id` as a non-nullable foreign key:

```typescript
// packages/core/src/drizzle/mixins.ts
import { text, timestamp, jsonb } from 'drizzle-orm/pg-core'

// Every entity table includes these columns
export const baseColumns = {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  customFields:   jsonb('custom_fields').default({})
}
```

The schema engine's `generateTableSql()` function always includes `baseColumns` and a foreign key reference to `organizations(id)`. There is no way to create an entity without `organization_id` through the public API.

### 14.2 `OrbitContext`

The runtime context object is threaded through every operation. All queries and mutations are scoped to it automatically.

```typescript
// packages/core/src/types/context.ts

type TenancyMode = 'multi-tenant' | 'single-tenant'
type Environment = 'development' | 'production' | 'test'
type AdapterType = 'supabase' | 'neon' | 'postgres' | 'sqlite'

interface OrbitContext {
  organizationId: string              // required; all queries scoped to this
  userId: string | null               // null for system/agent operations
  userRole: 'admin' | 'editor' | 'viewer' | 'system'
  tenancyMode: TenancyMode
  environment: Environment
  adapter: AdapterType
  requestId?: string                  // for API request tracing
  destructiveApproved?: boolean       // set to true only after human confirms
  dryRun?: boolean                    // schema operations: generate SQL but don't apply
}
```

### 14.3 Context Injection Patterns

Context is never global state. It is passed explicitly or bound at client construction time:

```typescript
// Direct usage (inside a server action or cron job):
const context: OrbitContext = {
  organizationId: org.id,
  userId: user.id,
  userRole: profile.role,
  tenancyMode: 'multi-tenant',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  adapter: 'supabase'
}
const contactOps = createEntityOperations(contacts, 'contacts', context)

// SDK usage (context bound at client construction):
const crm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  organizationId: 'org_01HX...',
  userId: 'user_01HX...'
})
// All crm.contacts.* calls use the bound context automatically
```

### 14.4 Initialization Modes

```bash
# Multi-tenant (default): every table has organization_id, RLS enforced
orbit init --mode multi-tenant --db supabase

# Single-tenant: organization_id column still exists (schema is compatible),
# but no RLS policies are generated — one org, one user
orbit init --mode single-tenant --db neon
```

The `--mode` flag is stored in `.orbit/config.json` and determines:
- Whether RLS policies are generated (multi-tenant: yes, single-tenant: no)
- Whether `OrbitContext.organizationId` is required at runtime (both modes: yes, but single-tenant mode creates a default org automatically)

### 14.5 Migration from Single-Tenant to Multi-Tenant

```typescript
// packages/core/src/migrations/to-multi-tenant.ts

export async function migrateToMultiTenant(
  defaultOrgName: string,
  context: OrbitContext
): Promise<MigrationResult> {
  // 1. Create the organizations table (if not already present)
  // 2. Create a default organization row
  // 3. Backfill organization_id = <default org id> on all existing rows
  // 4. Add NOT NULL constraint to organization_id columns
  // 5. Generate and apply RLS policies for all entities
  // 6. Update .orbit/config.json: mode = 'multi-tenant'

  const steps: string[] = []

  const defaultOrgId = generateId('org')
  steps.push(
    `INSERT INTO crm_app.organizations (id, name, created_at) VALUES ('${defaultOrgId}', '${defaultOrgName}', now());`
  )

  for (const entityType of BUILT_IN_ENTITIES) {
    steps.push(
      `UPDATE crm_app.${entityType} SET organization_id = '${defaultOrgId}' WHERE organization_id IS NULL;`,
      `ALTER TABLE crm_app.${entityType} ALTER COLUMN organization_id SET NOT NULL;`
    )
  }

  for (const entityType of BUILT_IN_ENTITIES) {
    const rlsSql = generateRlsSql(entityType, { mode: 'multi-tenant' })
    steps.push(...rlsSql)
  }

  if (!context.dryRun) {
    for (const stmt of steps) {
      await context.raw(stmt)
    }
  }

  return {
    success: true,
    migrationId: generateMigrationId('migrate_to_multi_tenant'),
    appliedAt: context.dryRun ? null : new Date(),
    sql: steps,
    warnings: ['All existing records have been assigned to the default organization. Review and redistribute if needed.'],
    errors: [],
    rollbackSql: [],                  // no safe rollback — document this limitation
    typesRegenerated: false
  }
}
```

### 14.6 RLS by Adapter

| Adapter | RLS Enforcement | Mechanism |
|---|---|---|
| **Supabase** | Database-level (strongest) | `get_my_org_id()` SECURITY DEFINER function; RLS policies on every table |
| **Neon / raw Postgres** | Database-level | Session variable `SET LOCAL orbit.org_id = '...'`; RLS policies read `current_setting('orbit.org_id')` |
| **SQLite** | Application-level only | No RLS support in SQLite; WHERE clause injected by `createEntityOperations()` for every query |

For Supabase, the schema engine generates:

```sql
-- Generated by generateRlsSql() for multi-tenant mode
ALTER TABLE crm_app.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON crm_app.contacts
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "contacts_insert" ON crm_app.contacts
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "contacts_update" ON crm_app.contacts
  FOR UPDATE USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "contacts_delete" ON crm_app.contacts
  FOR DELETE USING (organization_id = get_my_org_id());
```

For Neon and raw Postgres:

```sql
ALTER TABLE crm_app.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON crm_app.contacts
  FOR SELECT USING (organization_id = current_setting('orbit.org_id', true));
-- ... insert, update, delete policies follow the same pattern
```

For SQLite, no DDL is generated. The `orbit doctor` command warns: `"SQLite adapter: multi-tenancy is enforced at the application layer only. RLS is not available. Never expose this instance to untrusted clients."`

---

## 15. Migration from Current Orbit CRM

This section documents how to extract data and schema from the current Orbit CRM (`smb-sale-crm-app`, `crm_app` schema) into Orbit AI's entity model.

### 15.1 Table Mapping

| Current Table (`crm_app`) | Orbit AI Entity | Migration Notes |
|---|---|---|
| `leads` | `contacts` + `deals` | Split: contact fields (name, email, phone, company, source, score) go to `contacts`; deal fields (budget, stage, expected_close) go to `deals`. Each lead becomes one contact + optionally one deal. |
| `communications` | `activities` | Rename table. Add `type` discriminator column with values `call`, `email`, `sms`, `whatsapp`, `meeting`, `note`. Map existing `medium` column to `type`. |
| `pipeline_config` | `pipelines` + `stages` | One row in `pipeline_config` becomes one row in `pipelines`. Each stage name becomes a row in `stages`. Add `is_won = false` and `is_lost = false` to all stages; manually mark terminal stages after migration. |
| `service_packages` | `products` | Rename table. Column mapping: `name → name`, `price → price`, `description → description`. Add `currency = 'USD'` default and `is_active = true` default. |
| `follow_up_tasks` | `tasks` | Rename table. Add `priority` column defaulting to `'medium'`. Map `is_done → is_completed`. |
| `quotes` | (deferred to v1.1) | Keep in `crm_app.quotes`; not migrated to Orbit AI entity model in v1.0. |
| `contracts` | `contracts` | Keep. Add `title` column (default to `"Contract for " || contact_name`). |
| `payments` | `payments` | Keep. Add `currency` column defaulting to `'USD'`. |
| `tags` | `tags` | Keep. Tags are already global-scope. |
| `lead_tags` | `entity_tags` | Rename. Add `entity_type = 'contacts'` column for all migrated rows. This table becomes polymorphic. |
| `sequences` | `sequences` | Keep. |
| `sequence_steps` | `sequence_steps` | Keep. |
| `sequence_enrollments` | `sequence_enrollments` | Keep. Simplify: remove fields not needed by core engine. |
| `sequence_events` | (merged into activities) | Sequence send/open/click events become `activities` rows with `type = 'email'`. |
| `profiles` + `org_members` | `users` + `org_members` | `profiles` becomes `users`. `id` references `auth.users.id` on Supabase adapter; on raw Postgres, managed directly. |
| `organizations` | `organizations` | Keep. SaaS billing fields (`stripe_customer_id`, `plan`, `trial_ends_at`) remain. |
| `audit_log` | `audit_log` | Keep. Add `before` and `after` JSONB columns (existing rows get `before = null`, `after = null`). Add `changes` text array column. |
| `app_settings` | (deferred to v1.1) | Config system is a separate subsystem. Existing `app_settings` rows remain accessible but are not part of the Orbit AI entity model in v1.0. |
| `booking_pages`, `booking_slots`, `bookings`, `working_hours` | (deferred to v1.1) | Booking subsystem kept as-is in v1.0. Will be extracted as `@orbit-ai/integrations/booking` in v1.1. |
| `marketing_*` (6 tables) | (deferred to v1.1) | Marketing analytics is kept as-is. Will be extracted as `@orbit-ai/integrations/analytics` in v1.1. |
| `import_history` | `import_history` | Keep. Already matches the core import/export model. |
| `push_subscriptions` | (not migrated) | Platform-specific. Not part of the CRM data model. |
| `google_tokens` | (not migrated) | Belongs to `@orbit-ai/integrations/google`. |
| `chat_sessions` | (not migrated) | AI chat sessions are application-layer state, not CRM entities. |
| `cron_state` | (not migrated) | Infrastructure table; stays in the Next.js app layer. |
| `field_definitions` | `field_definitions` | New table (does not exist in current Orbit CRM). Created by schema engine at `orbit init`. |
| `schema_migrations` | `schema_migrations` | New table. Tracks all schema engine operations. |

### 15.2 `leads` Split Migration Script

The `leads` split is the most complex migration step. Each `leads` row produces one `contacts` row and, if the lead has deal-specific data, one `deals` row.

```typescript
// packages/core/src/migrations/from-orbit-crm/split-leads.ts

export async function splitLeads(context: OrbitContext): Promise<{ contacts: number, deals: number }> {
  const leads = await legacyDb.select().from(legacyLeads)
    .where(eq(legacyLeads.organizationId, context.organizationId))

  let contactCount = 0
  let dealCount = 0

  for (const lead of leads) {
    // Map lead → contact
    const contactId = generateId('contact')
    await db.insert(contacts).values({
      id: contactId,
      organizationId: context.organizationId,
      name: lead.name,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      title: lead.jobTitle ?? null,
      sourceChannel: lead.source ?? null,
      assignedTo: lead.assignedTo ?? null,
      leadScore: lead.score ?? 0,
      isHot: lead.isHot ?? false,
      notes: lead.notes ?? null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      customFields: {}
    })
    contactCount++

    // Map lead → deal (only if deal-relevant data present)
    const hasDealData = lead.budget || lead.stage || lead.expectedClose
    if (hasDealData) {
      const stageId = await resolveOrCreateStage(lead.stage, context)
      await db.insert(deals).values({
        id: generateId('deal'),
        organizationId: context.organizationId,
        title: `Deal with ${lead.name}`,
        value: lead.budget ?? null,
        stageId,
        contactId,
        assignedTo: lead.assignedTo ?? null,
        expectedCloseDate: lead.expectedClose ?? null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        customFields: {}
      })
      dealCount++
    }
  }

  return { contacts: contactCount, deals: dealCount }
}
```

### 15.3 `lead_tags` Generalization

```sql
-- Convert lead_tags to polymorphic entity_tags
ALTER TABLE crm_app.lead_tags RENAME TO entity_tags;
ALTER TABLE crm_app.entity_tags ADD COLUMN entity_type text NOT NULL DEFAULT 'contacts';
ALTER TABLE crm_app.entity_tags RENAME COLUMN lead_id TO entity_id;

-- Drop the old default (entity_type is now managed by application)
ALTER TABLE crm_app.entity_tags ALTER COLUMN entity_type DROP DEFAULT;
```

### 15.4 `audit_log` Column Additions

```sql
-- Add before/after diff columns to existing audit_log
ALTER TABLE crm_app.audit_log
  ADD COLUMN IF NOT EXISTS before jsonb,
  ADD COLUMN IF NOT EXISTS after  jsonb,
  ADD COLUMN IF NOT EXISTS changes text[];

-- Existing rows have no snapshot data — that is acceptable
-- New rows written by Orbit AI will always populate before/after/changes
```

### 15.5 Verification Query

After running the migration, use this query to verify the split was complete:

```sql
-- Should return 0 if all leads have been migrated to contacts
SELECT COUNT(*) FROM crm_app.leads l
LEFT JOIN crm_app.contacts c ON c.organization_id = l.organization_id
  AND c.email = l.email
WHERE c.id IS NULL
  AND l.organization_id = '<your-org-id>';
```
