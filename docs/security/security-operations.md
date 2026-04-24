# Security Operations

_Last updated: 2026-04-24_

This document turns the security tooling recommendation into an operating policy
for day-to-day PR review. The goal is to improve security without making every PR
wait on every deep check.

## PR Comment Handling

Automated review comments from Copilot, Codex, CodeQL, Socket, Dependabot, or
future tooling should be handled in one of four ways:

1. **Fix now** when the comment identifies a real bug, broken link, invalid
   example, dependency risk, or security issue.
2. **Resolve with explanation** when the finding is correct but intentionally
   accepted for alpha, tests, or local-only tooling.
3. **Create follow-up issue** when the finding is valid but too large for the
   current PR.
4. **Dismiss as false positive** only with a short reason.

Required conversation resolution is enabled on `main`, so unresolved review
threads block merge.

## Security Tools

### Socket

Use Socket as the first dependency and supply-chain security tool.

Initial policy:

- Install the Socket GitHub app for this public repository.
- Start in non-blocking PR comment/check mode.
- Block only high-confidence malware, compromised packages, severe supply-chain
  risk, and unacceptable license findings after a short tuning period.
- Do not treat every transitive advisory as merge-blocking until it is triaged.

### GitHub CodeQL

Use CodeQL as the first static-analysis tool.

Initial policy:

- GitHub CodeQL default setup was enabled on 2026-04-24 for GitHub Actions and
  JavaScript/TypeScript using the default query suite.
- Keep CodeQL non-required until the first alert batch is triaged.
- Fix high-confidence security findings promptly.
- Suppress false positives with a clear justification in GitHub code scanning.

### CodeRabbit / Copilot Reviews

Use AI PR review as review assistance, not as the primary security gate.

Recommended policy:

- Keep automated review comments enabled for documentation, examples, and code
  quality feedback.
- Do not rely on CodeRabbit or Copilot as a replacement for Socket, CodeQL, or
  maintainer review.
- Consider CodeRabbit later if external PR volume grows and we want broader PR
  summarization and review assistance.

## CI Triage Policy

The required PR gate is `Build, typecheck, lint, test`. That job intentionally
excludes the `@orbit-ai/e2e` package so E2E coverage is owned by explicit E2E
jobs instead of running twice.

Deep E2E runs are intentionally scoped:

- Run all E2E on pushes to `main`.
- Run all E2E when manually started through `workflow_dispatch`.
- Run SQLite E2E automatically for source changes in core runtime surfaces.
- Run Postgres E2E automatically for core/API/SDK or E2E harness changes.
- Do not automatically run deep E2E for docs-only changes or dependency manifest
  bumps unless the maintainer manually dispatches it.
- Watch E2E jobs before merging high-risk PRs even when they are not branch
  protection requirements.

For risky dependency PRs, manually run E2E before merge when the dependency affects:

- database behavior (`drizzle-orm`, `pg`)
- HTTP/API behavior (`hono`)
- auth/OAuth (`google-auth-library`)
- payments (`stripe`)
- CLI parsing/rendering (`commander`, `ink`)
- runtime or build tooling used during publish

## Dependabot Triage

Triage order:

1. Security advisories with active exploitability.
2. Runtime dependencies used by published packages.
3. GitHub Actions updates.
4. Development dependency groups.

Default handling:

- Merge patch updates after required CI passes and changelog review.
- Review major updates manually.
- Keep security-sensitive packages in separate PRs.
- Do not merge grouped dev dependency updates if they obscure the failing package.
