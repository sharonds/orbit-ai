# CLAUDE.md

## Project

Orbit AI — CRM infrastructure for AI agents and developers. TypeScript monorepo (Turborepo + pnpm). All 5 packages implemented: `@orbit-ai/core`, `@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/cli`, `@orbit-ai/mcp`. 1,088 tests passing. Not yet published to npm.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm -r build             # Build all packages (core must build first)
pnpm -r test              # Run all tests (vitest) — expect 1092 passing
pnpm -r typecheck         # TypeScript type checking
pnpm -r lint              # Lint all packages

# Run the quickstart example (end-to-end smoke test)
cd examples/nodejs-quickstart && pnpm start
```

**Important**: after any `packages/core/src` change, run `pnpm --filter @orbit-ai/core build` before typecheck or running api/sdk tests (they depend on core's compiled output).

## Monorepo Structure

```
packages/core/    # @orbit-ai/core — schema engine, entities, adapters (Drizzle ORM)
packages/sdk/     # @orbit-ai/sdk — TypeScript client SDK (HTTP + DirectTransport)
packages/api/     # @orbit-ai/api — Hono REST API server
examples/         # nodejs-quickstart (runnable E2E smoke test)
docs/             # Strategy, specs, security, review artifacts, implementation plans
```

**Not yet implemented** (separate plans, don't reference in code):
- `packages/integrations/` — Gmail, Google Calendar, Stripe connectors
- `apps/docs/` — Documentation site

## Tech Stack

- **Language**: TypeScript (strict)
- **ORM**: Drizzle ORM (programmatic migration API via `drizzle-kit/api`)
- **API**: Hono (14KB) — runs on Node/Bun/Deno/Edge
- **Validation**: Zod v4 (`^4.1.11` in both core and api)
- **Tests**: Vitest
- **Storage adapters**: SQLite (`node:sqlite`), Postgres (raw `pg`), Supabase, Neon
- **Node**: 22+ required (`node:sqlite` is stable in 22)

## Key Architecture Rules

- Every table MUST include `organization_id` + RLS policy (Postgres adapters)
- All schema definitions use Drizzle ORM syntax — never raw SQL strings
- Never import across packages using relative paths — use `@orbit-ai/*` package names
- Migrations are transaction-wrapped with reverse migrations in `packages/core/src/migrations/`
- Test migrations on SQLite adapter before Postgres adapters
- Agent-safe by default: ADD is allowed, DROP/RENAME requires `--destructive` flag
- Zod v4: use `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`
- ZodError handling: use duck-type guard (`name === 'ZodError' && Array.isArray(issues)`), not `instanceof`
- IdempotencyStore: in-memory default is single-instance only; multi-instance needs custom store via `CreateApiOptions.idempotencyStore`

## Adding an Entity

1. Drizzle schema in `packages/core/src/schema/<entity>.ts`
2. Types in `packages/core/src/types.ts`
3. Repository in `packages/core/src/entities/<entity>/repository.ts`
4. Service in `packages/core/src/entities/<entity>/service.ts`
5. Wire into `packages/core/src/services/index.ts` (createCoreServices)
6. REST routes in `packages/api/src/routes/<entity>.ts`
7. Register in `packages/api/src/create-api.ts`
8. Resource in `packages/sdk/src/resources/<entity>.ts`
9. Wire into `packages/sdk/src/client.ts`
10. Export types (NOT class) from `packages/sdk/src/index.ts`

## Adding a Storage Adapter

1. Create `packages/core/src/adapters/<name>/adapter.ts`
2. Implement `StorageAdapter` interface from `packages/core/src/adapters/interface.ts`
3. Create database + schema setup files
4. Export from `packages/core/src/index.ts`

## Base Entities (12)

contacts, companies, deals, pipeline_stages, activities, products, payments, contracts, channels, sequences, tags, notes

Plus: users, webhooks, imports, schema-migrations, idempotency-keys, api-keys, organizations, organization-memberships, audit-logs, custom-field-definitions, webhook-deliveries

## Environment Variables

See `.env.example` at repo root for the full list with comments.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (Postgres) | Postgres connection string |
| `ORBIT_API_KEY` | Yes (SDK client) | API key for authentication |
| `ORBIT_API_PORT` | No | Server port (default: 3000) |
| `ORBIT_API_VERSION` | No | API version header (default: 2026-04-01) |

## How We Work

### Development Cycle

Every feature follows this pipeline — no skipping steps:

```
1. BRAINSTORM   superpowers:brainstorming
                → Collaborative spec with explicit approval gate before any code
                → Output: docs/superpowers/specs/YYYY-MM-DD-<name>.md

2. PLAN         superpowers:writing-plans
                → Converts spec into step-by-step impl plan with exact file paths,
                  full code blocks, TDD steps, and expected command output
                → Output: docs/superpowers/plans/YYYY-MM-DD-<name>.md

3. WORKTREE     superpowers:using-git-worktrees
                → Isolated branch; verifies baseline tests pass before any changes

4. EXECUTE      superpowers:subagent-driven-development
                → One sub-agent per task; ~100-line slices; commit after each slice
                → After each task: superpowers:requesting-code-review
                → At trigger points: run the orbit-specific skill (see below)

5. WRAP-UP      orbit-plan-wrap-up
                → Update test baseline in CLAUDE.md, memory, package READMEs,
                  CHANGELOG.md; verify spec coverage
                → Run BEFORE pr-review-toolkit

6. PRE-PR       pr-review-toolkit:review-pr
                → Run all 6 specialist agents before creating the PR
                → Key agents for orbit: type-design-analyzer, silent-failure-hunter,
                  pr-test-analyzer
                → Also run the pre-PR checklist (see below)

6. PR           superpowers:finishing-a-development-branch
                → Creates PR via gh pr create with summary and test plan

7. POST-PR      code-review:code-review
                → Posts structured GitHub review comment after PR is open
```

### Orbit-Specific Review Triggers

These skills are **mandatory** at their trigger points — run in addition to the general flow:

| Trigger | Skill |
|---------|-------|
| Schema change (new table, column, index) | `orbit-schema-change` |
| New REST route or route modification | `orbit-api-sdk-parity` |
| New/modified SDK resource | `orbit-api-sdk-parity` |
| Completing a core slice or milestone | `orbit-core-slice-review` |
| Any service/repo/adapter touching tenant data | `orbit-tenant-safety-review` |

### Pre-PR Checklist

Run this before step 5 (pr-review-toolkit). Fix any failure before proceeding.

```bash
# If packages/core/src changed:
pnpm --filter @orbit-ai/core build

# Always:
pnpm -r build
pnpm -r typecheck
pnpm -r test        # must be ≥ current baseline (update baseline below after merges)
pnpm -r lint
```

**Test baseline**: 1108 tests (update this number after each merge to main)

**Before any npm-publish branch**: verify `CHANGELOG.md` is updated and `files` field in each `package.json` is correct (`dist/`, `README.md`, `LICENSE` only).

### PR Review Tool — Which to Use When

| When | Tool | Purpose |
|------|------|---------|
| After each task, during execution | `superpowers:requesting-code-review` | Plan compliance + code quality per task |
| End of all tasks, before PR | `pr-review-toolkit:review-pr` | 6 specialist agents, confidence ≥80 threshold |
| After PR is open on GitHub | `code-review:code-review` | Posts structured comment to the PR |

Do not substitute one for another — they serve different points in the pipeline.

### Keeping This File Current

Update this file when:
- A new architectural rule is established (add to **Key Architecture Rules**)
- A new entity or adapter pattern is added (update **Adding an Entity / Adapter**)
- The test baseline changes after merges (update the number in **Pre-PR Checklist**)
- The workflow itself changes based on what works / doesn't work

When updating, keep sections concise. Prefer tables and numbered lists over prose.

---

## Gotchas

- This is NOT `smb-sale-crm-app` (the Next.js CRM app). This is the extracted infrastructure project.
- All 5 packages (`core`, `api`, `sdk`, `cli`, `mcp`) are implemented but NOT yet published to npm.
- The `files` field in each package.json limits `pnpm pack` to `dist/`, `README.md`, `LICENSE`.
- Core build script runs `rm -rf dist && tsc` to prevent stale test artifacts in tarballs.
- SDK barrel does NOT export resource classes (ContactResource etc.) — only types. Consumers access resources via `client.contacts`, not by constructing classes.
- `MemoryIdempotencyStore._reset()` is private — test-only access is via `_resetIdempotencyStore()` module function.
- Key docs: `docs/META-PLAN.md` (master plan), `docs/IMPLEMENTATION-PLAN.md` (execution baseline), `docs/product/release-definition-v1.md` (v1 GA gates), `docs/review/2026-04-08-post-stack-audit.md` (alpha audit).
