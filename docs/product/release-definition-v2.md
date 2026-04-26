# Orbit AI Release Definition v2 — alpha.1 Launch Gate

**Date:** 2026-04-23
**Status:** Active — supersedes `release-definition-v1.md` for alpha.1 scope
**Aligned with:** [docs/vision/2026-04-23-orbit-vision-and-roadmap.md](../vision/2026-04-23-orbit-vision-and-roadmap.md)

---

## 1. Purpose

This document defines what must be true for Orbit AI to publish `0.1.0-alpha.1` to npm.

v1 (dated 2026-03-31) was scoped as a GA-readiness bar. v2 is scoped as an **alpha launch bar** — a much narrower gate focused on "external developers can install it, run it, and hit real edges."

GA-era gates (full security review sign-off, interface parity matrix checked in, sign-off owners named, traffic-light release state) are deferred to a future `release-definition-v3.md` that will apply to `1.0.0` GA.

## 2. What alpha.1 Means

- The first publicly installable Orbit AI release on npm.
- All 8 packages (`core`, `api`, `sdk`, `cli`, `mcp`, `integrations`, `demo-seed`, `create-orbit-app`) published under `0.1.0-alpha.1`.
- Documented, reproducible install path for an external developer.
- Cross-surface story demonstrably works against a realistic dataset.

**alpha.1 does not mean:**
- GA-stable semver
- production support commitments
- hosted offering
- complete integration matrix
- complete framework adapter matrix

## 3. Scope Included

### 3.1 Packages published to npm

- `@orbit-ai/core`
- `@orbit-ai/api`
- `@orbit-ai/sdk`
- `@orbit-ai/cli`
- `@orbit-ai/mcp`
- `@orbit-ai/integrations`
- `@orbit-ai/demo-seed` *(new — introduced for alpha.1)*
- `@orbit-ai/create-orbit-app` *(new — introduced for alpha.1)*

### 3.2 Adapter support

- SQLite (`node:sqlite`) — local development path
- Postgres (raw `pg`) — production path
- Supabase — production path
- Neon — production path

### 3.3 Integration scope

Same as v1: Gmail, Google Calendar, Stripe.

### 3.4 Public surface

- Landing page at a committed domain with one-line pitch, install command, link to docs, beta waitlist signup.
- `@orbit-ai/create-orbit-app` scaffolder producing a runnable starter seeded with demo data.

## 4. Scope Explicitly Excluded

- Semantic recall / vector stores (Wave 1, post-alpha.1)
- Framework adapters (LangChain / Mastra / Vercel AI / OpenClaw — Wave 2 contingent)
- Additional channels (Telegram / Slack / WhatsApp — Wave 2 contingent)
- Orbit Research (separate product, Wave 2 Option A contingent)
- Orbit GTM (conceptual only)
- Hosted cloud offering (post-GA)

## 5. Release Gate — Required User Journeys

All 15 journeys inherited from v1 Section 5.1 plus Plan C hardening must work end-to-end against the `@orbit-ai/demo-seed` dataset, driven by automated tests.

| # | Journey | Primary surface(s) |
|---|---|---|
| 1 | Initialize a project with `orbit init` | CLI |
| 2 | Configure an adapter and create working local context | CLI + core |
| 3 | Create, list, get, update, delete **contacts** | SDK + API + CLI + MCP |
| 4 | Create, list, get, update, delete **companies** | SDK + API + CLI + MCP |
| 5 | Create, list, get, update, delete **deals** | SDK + API + CLI + MCP |
| 6 | Move a deal between pipeline stages | SDK + API |
| 7 | Inspect schema and add a custom field safely | CLI + core |
| 8 | Migration preview/apply alpha stub passthrough; not a migration-safety gate | CLI + core |
| 9 | Use the SDK in **HTTP mode** against the API | SDK + API |
| 10 | Use the SDK in **direct-core** mode (DirectTransport) | SDK + core |
| 11 | Start the MCP server and execute core tool flows | MCP |
| 12 | Configure **Gmail** connector successfully | Integrations + CLI |
| 13 | Configure **Google Calendar** connector successfully | Integrations + CLI |
| 14 | Configure **Stripe** connector successfully | Integrations + CLI |
| 15 | Prove tenant isolation for seeded contacts and deals | SDK HTTP + SDK Direct + raw API + CLI API mode + MCP |

### 5.1 Journey test requirements

- Each journey is a named, automated E2E test file under `e2e/journeys/`.
- Each journey test runs against at least the SQLite adapter. Journeys 2–12 and 15 additionally run against one Postgres adapter (Neon or local Postgres).
- Tests use the deterministic `@orbit-ai/demo-seed` dataset as baseline fixture.
- Tests are executed in CI as part of the release pipeline — a failing journey blocks publish.

### 5.1.1 Plan C evidence and limitations

- Journey 8 is an alpha stub passthrough check only. It does **not** prove migration safety; destructive migration analysis and real preview/apply semantics remain deferred to Plan C.5.
- Journey 15 is the tenant-isolation gate across SDK HTTP, SDK Direct, raw API, CLI API mode, and MCP. It explicitly covers contacts and deals only; broader entity isolation is deferred.
- The Postgres gate is valid only when runtime adapter proof is present and the CI Postgres matrix passes. Restricted-role Postgres RLS is not proved by Plan C; tenant isolation remains application-layer E2E coverage.
- CRUD parity includes read-after-update assertions so create/list/get/update/delete journeys prove persisted updates, not only command success.
- Journey 11 requires every listed core MCP tool to be invoked. It uses an in-process MCP transport and does not cover stdio wire behavior.
- DirectTransport `PATCH`/`DELETE` of custom fields remains a known limitation until Plan C.5 implements `engine.updateField` and `engine.deleteField`.
- Connector journeys persist and redact credentials only; they do not prove live Gmail, Google Calendar, or Stripe provider dispatch.
- npm Trusted Publishing, Dependabot, and `pnpm audit` gating remain deferred per Plan B follow-ups.

### 5.2 Fail conditions for alpha.1

alpha.1 **does not publish** if:
- Any of the 15 journeys lacks a passing automated test.
- Any published package has a broken `files` manifest (missing `dist/`, `README.md`, or `LICENSE`).
- The `@orbit-ai/create-orbit-app` starter fails a clean `npm install && npm start` on a fresh machine.
- The landing page lacks a working waitlist signup or install command.

## 6. Interface Parity (relaxed for alpha.1)

alpha.1 inherits the existing implementation. A formal parity matrix is **not required** for alpha.1 (deferred to GA). However:

- CRUD journeys (3, 4, 5) must demonstrate the same entity semantics across SDK, API, CLI, and MCP.
- Journey 5 must reject deal values outside `numeric(18,2)` consistently across raw API, SDK HTTP, SDK Direct, CLI JSON, and MCP.
- Any known parity drift is documented in `docs/known-limitations.md` at publish time.

## 7. Security Baseline (inherited, not re-verified)

alpha.1 inherits the security posture from the 2026-04-08 post-stack audit (all HIGH and MEDIUM findings resolved, PRs #25 and #38). No new security review is required for alpha.1 **unless** new code paths introduce new attack surface.

New packages introduced in alpha.1:
- `@orbit-ai/demo-seed` — data-only package, no network / no auth / no user input. Security scope: verify no hardcoded real credentials in fixtures.
- `@orbit-ai/create-orbit-app` — scaffolder only, no network beyond npm install. Security scope: verify no arbitrary-file write outside the target directory.

## 8. Documentation Gate

alpha.1 requires:
- Root `README.md` with install command, quickstart, link to docs
- `README.md` in each published package (`core`, `api`, `sdk`, `cli`, `mcp`, `integrations`, `demo-seed`, `create-orbit-app`) — **current state: 8/8 present**
- `CHANGELOG.md` with the `0.1.0-alpha.1` entry
- `docs/known-limitations.md` listing any known drift
- Landing page linking to the GitHub repo and npm packages

## 9. Operational Gate

alpha.1 requires:
- npm publish pipeline (changesets) in CI — committed to `main`, runnable on tag
- All 6 existing packages + 2 new packages published under `@orbit-ai/*` scope
- Git tag `v0.1.0-alpha.1` pushed and matching the npm release
- Post-publish sanity on a clean machine:
  ```bash
  npx @orbit-ai/create-orbit-app@alpha my-app --yes
  cd my-app
  npm start
  ```
  This must prove the generated app installs published dependencies, seeds demo data, and prints real rows.

## 10. Success Criteria (post-publish, first 30 days)

Tracked continuously but **not gates** for publishing:

- External developers install it without maintainer handholding
- At least 3 non-author users hit real edges and file issues
- The T+30 decision ritual (canonical vision §5.3.1) has enough strong-signal data to choose Wave 2 direction

## 11. Non-Goals for alpha.1 (explicit)

Listed to prevent scope creep during plan execution:

- No custom entity types beyond the existing 12
- No new storage adapters
- No semantic search
- No new integrations beyond Gmail / Calendar / Stripe
- No UI beyond the static landing page
- No hosted endpoints
- No paid tier infrastructure

## 12. Final Rule

Orbit AI is alpha.1-ready when:
1. All 15 journeys pass in CI against the demo seed
2. All 8 packages publish cleanly to npm under `0.1.0-alpha.1`
3. `npx @orbit-ai/create-orbit-app@alpha my-app --yes` works end-to-end on a fresh machine
4. The landing page is live with a working waitlist
5. `CHANGELOG.md` reflects the release

Anything short of that is a pre-release milestone, not alpha.1.
