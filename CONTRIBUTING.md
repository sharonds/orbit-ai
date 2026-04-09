# Contributing to Orbit AI

Thanks for your interest in contributing. This document covers the essentials for
getting your development environment set up, understanding the project layout, and
getting a pull request merged.

## Ground rules

- Be kind and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Security issues** go to `security@orbit-ai.dev` — not a public issue. See
  [SECURITY.md](SECURITY.md).
- One concern per PR. A refactor and a feature in the same PR will be asked to split.
- All non-trivial changes must include tests. PRs that drop coverage significantly
  will be asked to add them.

## Dev environment

**Required:**

- Node.js 22+ (the SQLite adapter uses `node:sqlite`, which is not available in
  older versions)
- pnpm 9+ (`npm install -g pnpm`)

**Never use npm or yarn** in this repo — the workspace is managed by pnpm and the
lockfile is pnpm-only.

## Setup

```bash
# Clone the repo
git clone https://github.com/orbit-ai/orbit-ai.git
cd orbit-ai

# Install all workspace dependencies
pnpm install

# Build all packages (required before running tests)
pnpm -r build

# Run all tests to confirm your environment is working
pnpm -r test
```

## Project layout

```
packages/
  core/   @orbit-ai/core  — schema, adapters, entity services, migrations
  api/    @orbit-ai/api   — Hono REST server (auth, rate limiting, idempotency)
  sdk/    @orbit-ai/sdk   — TypeScript client (HTTP + DirectTransport)

docs/
  specs/          Per-component specs (01-core.md through 06-integrations.md)
  review/         Post-audit reports and gate reviews
  security/       Threat model and hardening checklists
  product/        Release definitions and product briefs

examples/
  nodejs-quickstart/   Minimal runnable example
```

Planned but not yet in the repo: `packages/cli`, `packages/mcp`,
`packages/integrations`.

## Common commands

```bash
# Build all packages
pnpm -r build

# Run all tests (vitest)
pnpm -r test

# Run tests for a single package
pnpm --filter @orbit-ai/core test
pnpm --filter @orbit-ai/sdk test

# Typecheck
pnpm -r typecheck

# Lint
pnpm -r lint

# Watch mode (all packages)
pnpm -r dev
```

## PR process

1. **Fork** the repo and create a branch off `main`: `git checkout -b feat/my-thing`
2. **Make your changes.** Keep commits focused and the diff readable.
3. **Write tests** — see the existing `src/__tests__/` directories in each package
   for patterns. We use Vitest.
4. **Run the full suite** before pushing: `pnpm -r build && pnpm -r typecheck && pnpm -r test`
5. **Open a PR** against `main`. Fill in the PR template (what changed, why, how to test).
6. **Address review feedback.** Push fixup commits — we squash on merge.
7. **Done.** A maintainer will merge once CI is green and the review is approved.

## Code style

- **TypeScript strict mode** is required. Every package has `"strict": true` in its
  tsconfig. Do not suppress errors with `any` or `// @ts-ignore` without a comment
  explaining why.
- **No silent failures.** Catch blocks must either rethrow, return a typed error, or
  log and handle explicitly. Empty catch blocks are rejected in review.
- **No `"private": true`** in package.json for packages that are intended to be
  published. The three current packages (`core`, `api`, `sdk`) are public.
- **Zod for all external input.** Any data crossing a trust boundary (HTTP request
  body, CLI argument, env var used at runtime) must be validated with a Zod schema.
  Do not manually type-cast unknown input.
- **Real tests, not trivial ones.** Tests should cover the meaningful behavior of the
  code, not just that a function can be called. Prefer integration-level tests using
  the SQLite adapter over mocked unit tests where practical.
- **No cross-package relative imports.** Import from `@orbit-ai/core`, not from
  `../../core/src/...`.

## Review workflow

PRs are reviewed within a few business days. The reviewer will use the labels
`approved`, `changes-requested`, or `blocked` (waiting on something external).

If your PR has been open for more than a week with no response, ping in the issue
thread — we don't want things to stall.
