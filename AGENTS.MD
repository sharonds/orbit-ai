# AGENTS.MD — Orbit AI

This file is machine-readable documentation for AI agents (Claude Code, Cursor, Copilot, and others). It describes what this project is, how it is structured, and how to contribute correctly.

---

## What Is This Project

Orbit AI is CRM infrastructure for AI agents and developers. It is NOT a CRM application. It provides the schema, CLI, SDK, REST API, and MCP server that let agents and developers build, manage, and extend their own CRM programmatically.

Analogy: Resend is to email what Orbit AI is to CRM.

The project is a TypeScript monorepo using Turborepo and pnpm workspaces. It is in pre-alpha. No packages are published yet.

---

## Repository Structure

```
orbit-ai/
├── packages/
│   ├── core/          # @orbit-ai/core — schema engine, entities, adapters
│   ├── sdk/           # @orbit-ai/sdk — TypeScript client SDK
│   ├── api/           # @orbit-ai/api — Hono REST API server
│   ├── mcp/           # @orbit-ai/mcp — MCP server (20+ tools)
│   └── cli/           # orbit CLI tool
├── apps/
│   └── docs/          # Documentation site
├── examples/
│   ├── nextjs-crm/    # Reference Next.js app built with @orbit-ai/sdk
│   └── agent-workflow/ # Agent-driven CRM automation example
├── docs/
│   ├── strategy/
│   │   ├── orbit-ai-prd.md   # Product Requirements Document
│   │   └── orbit-ai-ard.md   # Architecture Research Document
│   └── research/
│       └── competitive-analysis.md
├── AGENTS.MD          # This file
├── README.md
├── LICENSE            # MIT
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Language | TypeScript (strict) | All packages |
| Monorepo | Turborepo + pnpm workspaces | `turbo.json` at root |
| ORM | Drizzle ORM | 7.4KB, Edge-compatible, programmatic migration API |
| API framework | Hono | 14KB, runs on Node/Bun/Deno/Edge |
| CLI framework | Commander.js + Ink | Ink for TUI rendering via json-render |
| MCP | @modelcontextprotocol/sdk | stdio transport (local) + HTTP transport (hosted) |
| Validation | Zod | Used throughout for schema validation |
| Test runner | Vitest | |
| Storage adapters | Supabase (MVP), Neon (MVP), SQLite (MVP) | |

---

## Key Concepts

### Schema Engine

The core differentiator. Allows safe, agent-driven schema evolution.

When `orbit schema add-field contacts wedding_date date --nullable` runs:
1. Validates field name, type compatibility, no conflicts
2. Generates migration SQL via `drizzle-kit/api` — `generateMigration()`
3. Updates RLS policies to cover the new field
4. Regenerates TypeScript types for the `Contact` type
5. Updates REST API, SDK, and MCP server to expose the new field
6. Previews the diff before applying (dry-run by default for agents)
7. Applies migration in a transaction
8. Records the migration for rollback

**Agent safety**: Agents can ADD columns/tables. They cannot DROP or rename without explicit `--destructive` flag. On Neon, branch-before-migrate is automatic.

### Core Data Model

Orbit uses one project-scoped database. Inside that database, the developer may run:

- single-organization mode
- multi-organization mode

The canonical object model is larger than the original CRM surface. Core first-party types include:

```
organizations, organization_memberships, users, api_keys,
contacts, companies, deals, pipelines, stages, activities, tasks,
notes, products, payments, contracts, sequences, sequence_steps,
sequence_enrollments, sequence_events, tags, entity_tags,
custom_field_definitions, webhooks, webhook_deliveries, imports,
schema_migrations, audit_logs, idempotency_keys
```

Entity IDs are text columns using type-prefixed ULIDs such as `org_`, `contact_`, and `deal_`.

Tenant-scoped tables include:
- `id`
- `organization_id`
- `created_at`
- `updated_at`

Some entity types also include `custom_fields jsonb` when the spec marks them extensible.

### Multi-Tenancy

Orbit AI does not own the auth layer. The embedding app or hosted runtime provides trusted context.

All tenant data is scoped by `organization_id`. The SDK accepts `context: { userId, orgId }` from the developer's auth provider (Supabase Auth, Clerk, NextAuth, custom).

```typescript
const crm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  context: { userId: 'user_01ABC...', orgId: 'org_01ABC...' }
})
```

RLS policies are auto-generated per entity. The pattern:
```sql
CREATE POLICY "org_members_only" ON contacts
  USING (organization_id = orbit.current_org_id());
```

Important rules:
- `organizations` is bootstrap-scoped and intentionally does not have `organization_id`
- tenant-scoped Postgres-family work must run inside `withTenantContext(...)`
- repositories still filter on `organization_id` even when RLS is enabled
- request paths may not use privileged migration or bypass credentials

### Agent-Safe Migrations

Non-destructive by default. The `--destructive` flag is required for DROP and RENAME operations. This prevents agents from accidentally destroying production data.

Rollback: Every migration stores its reverse migration. `orbit migrate --rollback` or `crm.schema.rollback()` applies the reverse.

Branch-before-migrate (Neon): When using the Neon adapter, the schema engine automatically creates a database branch, runs the migration there, validates, then merges. This gives a safe preview on real data.

### MCP Server

The `@orbit-ai/mcp` package exposes 23 core tools across 8 tiers.

The default pattern is Attio-style universal tools with `object_type` parameters rather than one dedicated tool per entity. Example core tools include:
- `search_records`
- `get_record`
- `create_record`
- `update_record`
- `delete_record`
- `list_tasks`
- `create_note`
- `get_schema`
- `create_custom_field`
- `import_records`

Connector packages may register namespaced extension tools in composite runtimes, but they do not change the 23-tool core contract.

Transport: stdio (local agents) and HTTP (hosted, `mcp.orbit-ai.dev/your-project`).

### CLI Output Modes

Every CLI command supports `--json` for structured output. Agents should always use `--json` mode.

CLI JSON must follow the reconciled shared-envelope rules from the specs. It may not invent metadata separately from the SDK/API contract.

```bash
orbit --json contacts list
# Returns a structured envelope or first-page JSON contract aligned with the SDK/API specs

orbit --json schema describe
# Returns: { "entities": { "contacts": { "fields": [...], "relationships": [...] } } }

orbit --json migrate --preview
# Returns: { "sql": "ALTER TABLE ...", "affected_rows_estimate": 0, "reversible": true }
```

---

## How to Contribute

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Supabase, Neon, or local Postgres instance (for integration tests)

Package-specific floor:

- `@orbit-ai/mcp` currently requires Node.js 22+ even though the broader repository baseline is Node.js 20+.

### Setup

```bash
git clone https://github.com/sharonsciammas/orbit-ai
cd orbit-ai
pnpm install
pnpm run build
```

### Package Scripts

```bash
pnpm run build        # Build all packages (via turbo)
pnpm run dev          # Watch mode for all packages
pnpm run test         # Run all tests
pnpm run lint         # Lint all packages
pnpm run typecheck    # TypeScript type checking
```

### Package Organization Rules

1. All packages under `packages/` are internal libraries (`@orbit-ai/*`)
2. All apps under `apps/` are deployable applications
3. All examples under `examples/` are standalone demos
4. Never import across package boundaries using relative paths — always use the package name
5. Every new tenant-scoped table MUST include `organization_id text NOT NULL`; bootstrap tables are explicitly exempt
6. Postgres-family tenant tables must receive generated RLS coverage; SQLite relies on app-layer tenant enforcement and is not a production isolation boundary

### Adding a New Entity

1. Update `packages/core/src/schema/tables.ts` and `packages/core/src/schema/relations.ts`
2. Register the ID prefix in `packages/core/src/ids/prefixes.ts`
3. Add the object type to `packages/core/src/types/entities.ts`
4. Add entity repository, service, and validators under `packages/core/src/entities/<entity>/`
5. Update generated Zod/types and any required search or serializer registration
6. Add REST route coverage in `packages/api` if the entity is part of the public API surface
7. Confirm MCP coverage through the 23 core tools or add an allowed extension/semantic tool only if the spec requires it
8. Add CLI coverage where the command surface requires it
9. Add `packages/core/src/entities/<entity>/AGENTS.MD`

### Adding a New Storage Adapter

1. Create `packages/core/src/adapters/<name>/index.ts`
2. Implement the `StorageAdapter` interface from `packages/core/src/adapters/interface.ts`
3. Export from `packages/core/src/adapters/index.ts`
4. Document in README.md adapter table

### Migration Guidelines

- Prefer Drizzle definitions and builders as the source of truth; handwritten SQL should be limited to explicitly documented cases such as generated Postgres RLS statements
- All migrations are transaction-wrapped
- Every migration MUST have a reverse migration
- Migration files are stored in `packages/core/src/migrations/`
- Test migrations on SQLite adapter before Postgres adapters

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ORBIT_API_KEY` | Yes (hosted) | API key for hosted Orbit AI |
| `DATABASE_URL` | Yes (self-hosted) | Postgres connection string |
| `ORBIT_ORG_ID` | No | Default organization ID (can be passed per-request) |
| `ORBIT_ADAPTER` | No | Storage adapter override (`supabase`, `neon`, `sqlite`) |

---

## Current Status

This repository is pre-alpha. No packages are published to npm. The planning, security, and execution baseline now exists. Active implementation starts with `packages/core` slice 1.

See:
- `docs/KB.md` for the current working hub
- `docs/strategy/orbit-ai-prd.md` for the product plan
- `docs/strategy/orbit-ai-ard.md` for technical architecture decisions
- `docs/execution/core-implementation-plan.md` for the active core execution order

---

## Agent Notes

- This is NOT the `smb-sale-crm-app` repository. That is a separate Next.js CRM application. This repository is the Orbit AI infrastructure project.
- All schema definitions use Drizzle ORM syntax — not Prisma, not MikroORM, not raw SQL strings.
- The `--json` flag is available on every CLI command. Use it in agent context.
- Prefer the canonical docs over this file if they conflict, and then update this file.
- MCP uses the 23-tool core model with universal `object_type` parameters plus optional namespaced extensions.
- IDs are type-prefixed ULIDs stored in text columns, not UUID columns.
- License is MIT. The packages are safe to embed in commercial SaaS products.
