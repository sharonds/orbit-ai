# Internal Knowledge Archive

Operational plans, review reports, findings, and execution ledgers are archived
outside this product repository.

**Archive repo:** `sharonds/orbit-ai-knowledge`

## What Stays Here

- Durable product and package documentation.
- Security architecture, security operations, and security policy docs.
- Current testing and release gates.
- Contributor-facing setup and usage documentation.

## What Goes To The Archive

- Agent implementation plans.
- Execution ledgers.
- Code review reports and findings reports.
- Temporary business E2E reports after durable conclusions are summarized into
  current docs.
- Historical audit artifacts.

## Migration Baseline

The initial archive migration copied artifacts from source commit
`58abcba5d0c761aa8d9de46f028a545acdeaf9ea` into
`sharonds/orbit-ai-knowledge`.

See the archive repo's `migration-manifest.md` for source-to-archive paths.

## Guardrail

`pnpm test:doc-hygiene` fails when operational artifacts are tracked in this
repo under `docs/reports/`, `docs/superpowers/`, root `REVIEW-*.md`, root
`PLAN-*-EXECUTION-LEDGER.md`, or root `CODEX-PLAN-*.md`.
