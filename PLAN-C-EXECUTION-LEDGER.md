# Plan C Execution Ledger

Plan: `docs/superpowers/plans/2026-04-25-plan-c-codex-followups.md`
Branch: `codex/plan-c-followups`

## Scope Rules

- No Claude branch names, `.claude/worktrees`, or Claude memory files.
- No out-of-scope dependency upgrades.
- No release-gate claim without runtime evidence.

## Task Evidence

| Task | Status | Commit | Runtime Evidence | Review Evidence | Notes |
|---|---|---|---|---|---|
| 1 Branch + ledger | Done | 18ab74b | `git switch -c codex/plan-c-followups origin/main`; `git status --short --branch`; `git diff --name-only`; `git diff --cached --name-only` | Controller review | Fresh execution branch from `origin/main`; plan artifact copied from committed planning branch via no-commit cherry-pick. |
| 2 Journey 8 honesty | Done | bc01a5b, ea3184c, 4d3ada5 | `PATH="/Users/sharonsciammas/.nvm/versions/node/v22.22.0/lib/node_modules/corepack/shims:/Users/sharonsciammas/.nvm/versions/node/v22.22.0/bin:$PATH" pnpm -F @orbit-ai/e2e test src/journeys/08-migration-preview-apply.test.ts` passed after final fix | Spec/code review by subagents; final review over `18ab74b..4d3ada5` found no Critical/High/Medium/Low findings | Fixed exact stub shape, removed unrelated field setup, and updated current release docs so Journey 8 does not claim migration safety. |
| 3 API listener harness | Pending |  |  |  |  |
| 4 Journey 15 tenant isolation | Pending |  |  |  |  |
| 5 Journey 11 MCP tools | Pending |  |  |  |  |
| 6 CRUD update persistence | Pending |  |  |  |  |
| 7 Adapter-aware CLI workspace | Pending |  |  |  |  |
| 8 CI Postgres matrix | Pending |  |  |  |  |
| 9 api_keys upsert safety | Pending |  |  |  |  |
| 10 run-mcp leak fix | Pending |  |  |  |  |
| 11 Stripe sentinel | Pending |  |  |  |  |
| 12 Schema-engine org context | Pending |  |  |  |  |
| 13 Deal value validation | Pending |  |  |  |  |
| 14 Docs + changeset | Pending |  |  |  |  |
| 15 Verification + reviews | Pending |  |  |  |  |
| 16 PR | Pending |  |  |  |  |

## Deferred Items

- Real schema migration preview/apply engine: Plan C.5.
- DirectTransport custom-field update/delete engine methods: Plan C.5.
- Real Gmail/Calendar/Stripe provider contract tests: separate connector test plan.
- MCP stdio wire E2E: separate MCP transport plan.
- Restricted-role Postgres RLS proof: separate Postgres RLS regression plan.
- Tenant-isolation coverage beyond contacts and deals: separate broader entity-isolation plan.
- npm Trusted Publishing, Dependabot, and `pnpm audit` gating: deferred per Plan B follow-ups and tracked outside Plan C.
