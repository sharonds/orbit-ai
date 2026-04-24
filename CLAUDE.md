# CLAUDE.md

## Project

Orbit AI — CRM infrastructure for AI agents and developers. TypeScript monorepo (Turborepo + pnpm). Packages: `@orbit-ai/core`, `@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/cli`, `@orbit-ai/mcp`, `@orbit-ai/integrations`, `@orbit-ai/demo-seed`, and the `@orbit-ai/create-orbit-app` scaffolder. Not yet published to npm.

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm -r build             # Build all packages (core must build first)
pnpm -r test              # Run all tests (vitest) — expect 1796 passing
pnpm -r typecheck         # TypeScript type checking
pnpm -r lint              # Lint all packages

# Run the quickstart example (end-to-end smoke test)
cd examples/nodejs-quickstart && pnpm start
```

**Important**: after any `packages/core/src` change, run `pnpm --filter @orbit-ai/core build` before typecheck or running api/sdk tests (they depend on core's compiled output).

## Monorepo Structure

```
packages/core/          # @orbit-ai/core — schema engine, entities, adapters (Drizzle ORM)
packages/sdk/           # @orbit-ai/sdk — TypeScript client SDK (HTTP + DirectTransport)
packages/api/           # @orbit-ai/api — Hono REST API server
packages/cli/           # @orbit-ai/cli — Terminal interface (Commander.js)
packages/mcp/           # @orbit-ai/mcp — Model Context Protocol server
packages/integrations/  # @orbit-ai/integrations — Gmail, Google Calendar, Stripe connectors
packages/demo-seed/      # @orbit-ai/demo-seed — Acme Events fixture (contacts/companies/deals)
packages/create-orbit-app/ # @orbit-ai/create-orbit-app — `npx @orbit-ai/create-orbit-app@alpha` scaffolder
examples/               # nodejs-quickstart (runnable E2E smoke test)
docs/                   # Strategy, specs, security, review artifacts, implementation plans
```

**Not yet implemented** (separate plans, don't reference in code):
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
- API/SDK serialization: core uses camelCase (Drizzle convention); the public API and SDK contracts are snake_case. Conversion happens at the boundary via `serializeEntityRecord` (response) and `deserializeEntityInput` (request) in `packages/api/src/serialization.ts` and `packages/sdk/src/transport/serialization.ts`. When adding a new entity, add it to `ENTITY_OBJECT_TYPES` in both files. When a core field name differs from its public name beyond casing, add it to `ENTITY_RESPONSE_RENAMES` / `ENTITY_INPUT_RENAMES`. Sensitive fields that must not appear in public responses go in `ENTITY_STRIP_FIELDS`.
- Secret-bearing entity fields (e.g. webhook `secretEncrypted`) must be added to `ENTITY_STRIP_FIELDS` in both serialization files AND verified via a unit test in `packages/api/src/__tests__/serialization.test.ts`.

## Coding Conventions

**These rules apply to every implementation task. Include them verbatim in every sub-agent brief.**

### Error handling
- Always bind the error variable: `catch (err)` — never bare `catch {}`
- Always log before swallowing: `writeStderrWarning(...)` or `console.error(...)` inside every catch
- Defensive cast before accessing `.message`: `err instanceof Error ? err.message : String(err)`
- Duck-type guards for cross-boundary errors (ZodError, OrbitApiError) — never `instanceof` for these

### Tests
- Tests ship in the same commit as the feature — never in a separate pass
- Every new code path gets at least one test: happy path + the most likely failure mode
- Tests assert behavior (inputs/outputs), not implementation (which function was called)

### No deferrals
- Any issue found on this branch is fixed on this branch — "pre-existing" is not a reason to skip
- No "non-blocking" items left open — if it's worth noting, it's worth fixing now

### Lint gates
- `pnpm -r lint` must pass before committing — not just before the PR
- Lint failures are convention violations, not style suggestions — fix them, don't suppress them

### Sensitive data
- `sanitizeObjectDeep` must be applied to all tool output that may contain user records
- `isSensitiveKey` covers both snake_case (`api_key`, `refresh_token`) and camelCase (`accessToken`, `clientSecret`) — if adding a new sensitive field name, add it to both branches

## Extension Reference

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for step-by-step guides on adding entities, adding storage adapters, and the full entity list.

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
                → Every implementer brief MUST include the Coding Conventions section above
                → Every implementer brief MUST define "done": build + tests + lint pass
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

**Test baseline**: 1796 tests (update this number after each merge to main)

**Before any npm-publish branch**: verify `CHANGELOG.md` is updated and `files` field in each `package.json` is correct (`dist/`, `README.md`, `LICENSE` only).

### PR Review Tool — Which to Use When

| When | Tool | Purpose |
|------|------|---------|
| After each task, during execution | `superpowers:requesting-code-review` | Plan compliance + code quality per task |
| End of all tasks, before PR | `pr-review-toolkit:review-pr` | 6 specialist agents, confidence ≥80 threshold |
| After PR is open on GitHub | `code-review:code-review` | Posts structured comment to the PR |
| Implementer is stuck / needs Codex cross-check | `codex:rescue` | Delegates investigation or a targeted fix to Codex via the shared runtime; use when sub-agent is BLOCKED or a second opinion is needed |

Do not substitute one for another — they serve different points in the pipeline.

### Review Stopping Criterion

A task is **done** when: `pnpm -r build && pnpm -r test && pnpm -r lint` all pass, tests cover the new path, and `superpowers:requesting-code-review` finds no MEDIUM+ issues.

The final `pr-review-toolkit:review-pr` should **confirm** quality, not **discover** it for the first time. If conventions are followed and commit-level reviews were run, one round of all 6 agents should be sufficient.

Stop the PR review loop when:
- All 6 agents report zero MEDIUM, HIGH, or CRITICAL issues
- Only cosmetic suggestions remain — file these as issues, don't block the PR

**Never** skip `superpowers:requesting-code-review` after each task slice — this is the root cause of multi-round catch-up loops. Conventions in sub-agent briefs prevent systematic violations. Commit-level review catches the remainder. The final review catches edge cases only.

### Keeping This File Current

Update this file when:
- A new architectural rule is established (add to **Key Architecture Rules**)
- A new entity or adapter is added (update step lists and entity name list in `docs/CONTRIBUTING.md`)
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
- Drizzle ORM returns camelCase JavaScript field names (e.g. `stageId`, not `stage_id`). The public API and SDK contract is snake_case. Zod strips unknown fields silently — passing `stage_id` to a schema expecting `stageId` drops the field with no error. Always pass through the serialization layer at the API/SDK boundary.
- DirectTransport dispatch handles 2-segment paths (entity + id) for CRUD and 3-segment paths (entity + id + verb) for workflow routes. If you add a new workflow verb (e.g. `/v1/deals/:id/archive`), add it to the `verb` dispatch block in `packages/sdk/src/transport/direct-transport.ts`.
