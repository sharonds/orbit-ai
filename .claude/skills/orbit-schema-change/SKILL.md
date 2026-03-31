---
name: orbit-schema-change
description: Guides schema and custom-field changes in Orbit AI so that migrations, metadata, adapters, API, SDK, CLI, and MCP stay aligned. Invoke this skill whenever adding a new table or entity, adding or promoting a custom field, changing the custom field contract, modifying migration or schema-engine behavior, editing files in packages/core/src/schema/, packages/core/src/schema-engine/, or packages/core/src/entities/, or when a task involves Drizzle table definitions, RLS policy generation, ID prefix registration, or storage adapter schema support. Schema misalignment across packages is Orbit's most common implementation drift — use this skill proactively for any schema-touching change.
---

# Orbit Schema Change

This skill guides schema changes so that every layer of the Orbit stack stays aligned: Drizzle definitions, ID system, custom field metadata, migration engine, RLS generation, and all four interfaces (API, SDK, CLI, MCP). Schema misalignment across packages is the most likely source of implementation drift.

## When to skip this skill

- Changes to CLI output formatting that don't alter data shapes
- Documentation-only edits
- Changes to test fixtures that don't reflect schema contract changes
- Connector/integration logic that doesn't create or modify tenant-scoped tables (use `orbit-tenant-safety-review` for tenant isolation concerns on connector tables)

## Step 1: Load context

Read the sections relevant to your change:

1. `docs/specs/01-core.md` — the authoritative source for:
   - Table definitions (section 5: Drizzle Schema Definitions)
   - ID prefix registry (section 3: ID System)
   - Custom field system (section 7: Custom Fields)
   - Schema engine interface (section 10: Schema Engine)
   - Adapter interface and authority model (section 8: Storage Adapter Interface)
   - RLS generation rules (section 9: RLS)
2. `docs/specs/02-api.md` — route structure, envelope format, pagination contracts
3. `docs/specs/03-sdk.md` — resource methods, transport parity between API and direct mode
4. `docs/specs/04-cli.md` — command surface and the `--json`/`.response()`/`firstPage()` contract
5. `docs/specs/05-mcp.md` — tool inventory and which tools expose schema/entity data

You don't need all five for every change. A new custom field might only need 01-core.md. A new entity needs all interface specs.

## Step 2: Classify the change

Determine which type of schema change you're making:

### Type A: Adding a table / entity
Touches everything — Drizzle definition, ID prefix, RLS, repositories, services, API routes, SDK resources, CLI commands, MCP tools.

### Type B: Adding or promoting a custom field
Primarily touches the schema engine and custom field metadata. May touch API/SDK/MCP if the field changes filter, sort, or search contracts.

### Type C: Modifying the custom field contract
Changes to how custom fields work (validation, promotion rules, JSONB handling). Touches schema engine internals and potentially all interfaces.

### Type D: Changing migration or schema-engine behavior
Changes to how migrations are generated, applied, rolled back, or how the schema engine validates operations. High-risk because it affects every adapter.

## Step 3: Execute the change checklist

### For Type A (new table/entity) — full checklist:

**Core package (`packages/core/`):**

1. **Drizzle table definition** in `src/schema/tables.ts`
   - `id: text('id').primaryKey()` — uses type-prefixed ULID
   - `organizationId: text('organization_id').notNull().references(() => organizations.id)` — unless this is a bootstrap table (only `organizations` is bootstrap in v1)
   - `...timestamps` — `created_at` and `updated_at`
   - `customFields: customFieldsColumn` — if the entity is extensible
   - Appropriate indexes (at minimum: org-scoped unique constraints)

2. **ID prefix** in `src/ids/prefixes.ts`
   - Add entry to `ID_PREFIXES` const
   - Prefix must be short, lowercase, descriptive, and not conflict with existing prefixes
   - Update `OrbitIdKind` type (derived automatically from `keyof typeof ID_PREFIXES`)

3. **Entity type** in `src/types/entities.ts`
   - Add to `OrbitObjectType` union

4. **Repository** in `src/entities/<entity>/repository.ts`
   - All queries must filter on `organization_id`
   - Use `withTenantContext(...)` for all Postgres-family operations

5. **Service** in `src/entities/<entity>/service.ts`
   - Injects `organization_id` from trusted context, never from caller input
   - Uses repository methods, not raw queries

6. **Validators** in `src/entities/<entity>/validators.ts`
   - Zod schemas for create/update inputs
   - ID validation using `assertOrbitId(value, kind)`

7. **RLS policy** — the RLS generator in `src/schema-engine/rls.ts` must include the new table in its tenant-scoped table list

8. **Relations** in `src/schema/relations.ts` — if the entity has foreign keys to other entities

**API package (`packages/api/`):**

9. **Routes** in `src/routes/` — CRUD endpoints following the envelope format
10. **OpenAPI schema** registered in `src/openapi/`

**SDK package (`packages/sdk/`):**

11. **Resource class** in `src/resources/<entity>.ts` — record-first methods, must work in both API mode and direct mode

**MCP package (`packages/mcp/`):**

12. **Tool registration** — determine if this entity needs new dedicated tools or is covered by the universal `search_records`/`get_record`/`create_record`/`update_record`/`delete_record` tools via `object_type` parameter. Core tool count is capped at 23 — don't add tools unless the entity has unique operations beyond CRUD.

**CLI package (`packages/cli/`):**

13. **Commands** in `src/commands/<entity>.ts` — supports `--json` flag for agent output

### For Type B (adding/promoting a field):

1. **Field definition** — if adding to a base table, modify `src/schema/tables.ts`. If adding a custom field, use the schema engine's `addField` path.
2. **Custom field metadata** — new entry in `custom_field_definitions` table with correct `entityType`, `fieldType`, validation rules
3. **Promotion check** — if promoting (JSONB → real column):
   - Requires `runWithMigrationAuthority(...)` — this is an elevated operation
   - SQLite promotion may require table recreation
   - The promoted column name must not conflict with existing columns
   - After promotion, reads must still merge promoted and JSONB fields into one logical shape
4. **Interface impact** — if the field affects filtering, sorting, or search:
   - API: update query parameter documentation
   - SDK: update TypeScript types
   - MCP: update tool input schemas if affected
   - CLI: confirm `--json` still flows through SDK `response()`/`firstPage()` helpers without reconstructing envelopes

### For Type C (custom field contract change):

1. **Schema engine** — changes to `src/schema-engine/` files
2. **Validation** — ensure `custom_fields` JSONB keys still match `custom_field_definitions`
3. **Promotion rules** — if changing how promotion works, check all adapter paths
4. **Backwards compatibility** — existing custom field data must not break
5. **Sanitized reads** — if custom field metadata or values can expose secret-bearing records, review read serializers and redaction markers

### For Type D (migration/schema-engine behavior):

1. **Authority boundary** — migrations run via `runWithMigrationAuthority(...)` only, never from runtime paths
2. **Rollback** — every migration must store its reverse
3. **Adapter coverage** — test on SQLite first, then Postgres-family adapters
4. **Non-destructive default** — DROP and RENAME operations require explicit `--destructive` flag
5. **Neon branching** — if the Neon adapter is involved, branch-before-migrate must still work
6. **Read-surface impact** — if migration behavior changes exposed shapes or secret-bearing objects, update API/SDK/CLI/MCP redaction expectations explicitly

## Step 4: Safety classification

Classify the change:

- **Additive safe**: New column, new table, new custom field (metadata-only). No migration review needed beyond standard checklist.
- **Additive with migration review**: Field promotion, new index on existing table, adding NOT NULL with default on existing table. Requires testing on all target adapters.
- **Destructive — blocked without explicit approval**: Column drop, column rename, table drop, type change on existing column. Requires `--destructive` flag in CLI/MCP, and must be blocked in hosted mode.

## Step 5: Produce the implementation checklist

Output a checklist specific to the change, structured as:

```
## Schema Change: [description]

### Classification
[Additive safe | Additive with migration review | Destructive]

### ID Prefix
- Prefix: `<prefix>` — [correct/needs-registration/N/A]

### Tenant Scoping
- [tenant-scoped | bootstrap-scoped] — [evidence]

### Impacted Packages and Files
- [ ] packages/core/src/schema/tables.ts — [what changes]
- [ ] packages/core/src/ids/prefixes.ts — [what changes]
- [ ] packages/core/src/entities/<entity>/... — [what changes]
- [ ] packages/api/src/routes/... — [what changes]
- [ ] packages/sdk/src/resources/... — [what changes]
- [ ] packages/mcp/src/tools/... — [what changes or "covered by universal tools"]
- [ ] packages/cli/src/commands/... — [what changes]

### Interface Contracts
- Pagination/filter/search: [unaffected | updated — describe]
- API envelope: [unaffected | updated — describe]
- SDK types: [unaffected | updated — describe]
- MCP tools: [unaffected | updated — describe]
- CLI --json output: [unaffected | updated — describe]
- Redaction/serializers: [unaffected | updated — describe]
```

## Step 6: Validation

Confirm all of these before marking the change as complete:

1. **ID prefix is correct**: the prefix exists in `ID_PREFIXES`, is unique, and matches the entity's semantic name
2. **Tenant vs bootstrap classification is explicit**: the code and schema clearly show whether this is org-scoped or bootstrap-scoped, with no ambiguity
3. **Pagination, filter, and search contracts are either unaffected or explicitly updated**: if a new entity is searchable, it must be added to the search service; if new fields are filterable, the API query params and SDK types must reflect this
4. **All affected interfaces are listed**: if the change touches API behavior, SDK, CLI, and MCP impact must all be assessed (even if "no change needed")
5. **Secret-bearing read surfaces are assessed**: if the schema change touches API keys, webhooks, webhook deliveries, integration credentials, provider errors, or similar fields, API/SDK/CLI/MCP serializer and redaction impact must be listed explicitly

If any check fails, flag it in the checklist before proceeding with implementation.
