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
| 1 Branch + ledger | Done | pending-sha | `git switch -c codex/plan-c-followups origin/main`; `git status --short --branch`; `git diff --name-only`; `git diff --cached --name-only` | Controller review | Fresh execution branch from `origin/main`; plan artifact copied from committed planning branch via no-commit cherry-pick. |
| 2 Journey 8 honesty | Pending |  |  |  |  |
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
