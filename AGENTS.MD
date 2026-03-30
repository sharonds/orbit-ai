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

### Base Entities

The 12 base entities every Orbit AI project starts with:

```
contacts, companies, deals, pipeline_stages, activities,
products, payments, contracts, channels, sequences, tags, notes
```

Each entity has:
- Standard fields (id, created_at, updated_at, organization_id)
- `custom_fields JSONB` for flexible extension without DDL
- Auto-generated RLS policies scoped to `organization_id`
- TypeScript types auto-generated from Drizzle schema

### Multi-Tenancy

All data is scoped by `organization_id`. The SDK accepts `context: { userId, orgId }` from the developer's auth provider (Supabase Auth, Clerk, NextAuth, custom). Orbit AI does NOT own the auth layer.

```typescript
const crm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  context: { userId: 'user_123', orgId: 'org_456' }
})
```

RLS policies are auto-generated per entity. The pattern:
```sql
CREATE POLICY "org_members_only" ON contacts
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### Agent-Safe Migrations

Non-destructive by default. The `--destructive` flag is required for DROP and RENAME operations. This prevents agents from accidentally destroying production data.

Rollback: Every migration stores its reverse migration. `orbit migrate --rollback` or `crm.schema.rollback()` applies the reverse.

Branch-before-migrate (Neon): When using the Neon adapter, the schema engine automatically creates a database branch, runs the migration there, validates, then merges. This gives a safe preview on real data.

### MCP Server

The `@orbit-ai/mcp` package exposes all CRM operations as MCP tools. Tools follow the naming pattern `orbit.<entity>.<operation>`.

Available tools:
- `orbit.contacts.create`, `orbit.contacts.list`, `orbit.contacts.get`, `orbit.contacts.update`, `orbit.contacts.delete`
- `orbit.companies.*` (same operations)
- `orbit.deals.create`, `orbit.deals.list`, `orbit.deals.get`, `orbit.deals.update`, `orbit.deals.delete`, `orbit.deals.move`
- `orbit.pipeline.view`, `orbit.pipeline.configure`
- `orbit.activities.log`, `orbit.activities.list`
- `orbit.schema.describe`, `orbit.schema.addField`, `orbit.schema.addEntity`, `orbit.schema.migrate`
- `orbit.analytics.summary`, `orbit.analytics.funnel`

Transport: stdio (local agents) and HTTP (hosted, `mcp.orbit-ai.dev/your-project`).

### CLI Output Modes

Every CLI command supports `--json` for structured output. Agents should always use `--json` mode.

```bash
orbit --json contacts list
# Returns: { "data": [...], "pagination": { "cursor": "...", "total": 42 } }

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
5. Every new table in any adapter MUST include `organization_id uuid NOT NULL` and an RLS policy

### Adding a New Entity

1. Add the Drizzle schema definition in `packages/core/src/schema/<entity>.ts`
2. Add the entity type to `packages/core/src/types.ts`
3. Add CRUD operations in `packages/core/src/entities/<entity>.ts`
4. Add REST routes in `packages/api/src/routes/<entity>.ts`
5. Add MCP tools in `packages/mcp/src/tools/<entity>.ts`
6. Add CLI commands in `packages/cli/src/commands/<entity>.ts`
7. Add an `AGENTS.MD` file in `packages/core/src/entities/<entity>/AGENTS.MD`

### Adding a New Storage Adapter

1. Create `packages/core/src/adapters/<name>/index.ts`
2. Implement the `StorageAdapter` interface from `packages/core/src/adapters/interface.ts`
3. Export from `packages/core/src/adapters/index.ts`
4. Document in README.md adapter table

### Migration Guidelines

- Never use raw SQL strings — always use Drizzle's programmatic API
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

This repository is pre-alpha. No packages are published to npm. The foundation (monorepo structure, strategy documents) is being established. Development begins with `packages/core`.

See `docs/strategy/orbit-ai-prd.md` for the full product plan and `docs/strategy/orbit-ai-ard.md` for technical architecture decisions.

---

## Agent Notes

- This is NOT the `smb-sale-crm-app` repository. That is a separate Next.js CRM application. This repository is the Orbit AI infrastructure project.
- All schema definitions use Drizzle ORM syntax — not Prisma, not MikroORM, not raw SQL strings.
- The `--json` flag is available on every CLI command. Use it in agent context.
- MCP tool names follow the pattern `orbit.<entity>.<operation>` — e.g., `orbit.contacts.create`, not `createContact`.
- License is MIT. The packages are safe to embed in commercial SaaS products.
