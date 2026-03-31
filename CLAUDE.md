# CLAUDE.md

## Project

Orbit AI — CRM infrastructure for AI agents and developers. TypeScript monorepo (Turborepo + pnpm). Pre-alpha: planning docs complete, implementation starting with `@orbit-ai/core`.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm run build            # Build all packages (turbo)
pnpm run dev              # Watch mode, all packages
pnpm run test             # Run all tests (vitest)
pnpm run lint             # Lint all packages
pnpm run typecheck        # TypeScript type checking
```

## Monorepo Structure

```
packages/core/    # @orbit-ai/core — schema engine, entities, adapters (Drizzle ORM)
packages/sdk/     # @orbit-ai/sdk — TypeScript client SDK
packages/api/     # @orbit-ai/api — Hono REST API server
packages/mcp/     # @orbit-ai/mcp — MCP server (stdio + HTTP transport)
packages/cli/     # orbit CLI tool (Commander.js + Ink)
apps/docs/        # Documentation site
examples/         # Reference apps (nextjs-crm, agent-workflow)
docs/             # Strategy, specs, security, implementation plans
```

## Tech Stack

- **Language**: TypeScript (strict)
- **ORM**: Drizzle ORM (programmatic migration API via `drizzle-kit/api`)
- **API**: Hono (14KB, runs on Node/Bun/Deno/Edge)
- **CLI**: Commander.js + Ink
- **MCP**: @modelcontextprotocol/sdk
- **Validation**: Zod
- **Tests**: Vitest
- **Storage adapters**: Supabase, Neon, SQLite (MVP wave)

## Key Architecture Rules

- Every table MUST include `organization_id uuid NOT NULL` + RLS policy
- All schema definitions use Drizzle ORM syntax — never raw SQL strings
- Never import across packages using relative paths — use `@orbit-ai/*` package names
- Migrations are transaction-wrapped and must have reverse migrations stored in `packages/core/src/migrations/`
- Test migrations on SQLite adapter before Postgres adapters
- Agent-safe by default: ADD is allowed, DROP/RENAME requires `--destructive` flag
- MCP tools follow `orbit.<entity>.<operation>` naming (e.g. `orbit.contacts.create`)
- CLI always supports `--json` flag for structured agent output

## Adding an Entity

1. Drizzle schema in `packages/core/src/schema/<entity>.ts`
2. Types in `packages/core/src/types.ts`
3. CRUD in `packages/core/src/entities/<entity>.ts`
4. REST routes in `packages/api/src/routes/<entity>.ts`
5. MCP tools in `packages/mcp/src/tools/<entity>.ts`
6. CLI commands in `packages/cli/src/commands/<entity>.ts`

## Adding a Storage Adapter

1. Create `packages/core/src/adapters/<name>/index.ts`
2. Implement `StorageAdapter` interface from `packages/core/src/adapters/interface.ts`
3. Export from `packages/core/src/adapters/index.ts`

## Base Entities (12)

contacts, companies, deals, pipeline_stages, activities, products, payments, contracts, channels, sequences, tags, notes

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (self-hosted) | Postgres connection string |
| `ORBIT_API_KEY` | Yes (hosted) | API key for hosted Orbit AI |
| `ORBIT_ADAPTER` | No | Storage adapter override (`supabase`, `neon`, `sqlite`) |
| `ORBIT_ORG_ID` | No | Default organization ID |

## Gotchas

- This is NOT `smb-sale-crm-app` (the Next.js CRM app). This is the extracted infrastructure project.
- No packages are published to npm yet. Development starts with `packages/core`.
- Key planning docs: `docs/IMPLEMENTATION-PLAN.md` (execution baseline), `docs/META-PLAN.md` (master plan), `docs/specs/01-core.md` through `06-integrations.md`.
- Neon adapter auto-creates a database branch before migration for safe preview.
