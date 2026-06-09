# Orbit AI Business E2E Scenario Map

**Date:** 2026-05-26
**Status:** Lead Qualification, Stalled Pipeline, Account 360,
Renewal/Expansion, fake Integration Event Simulation, and first MCP Agent Q&A
smoke implemented; generated UI catalog remains proposed

## Purpose

Orbit's current E2E suite proves that the published surfaces can create, read,
update, delete, authenticate, paginate, and enforce basic tenant isolation. The
next gate should prove that Orbit behaves like useful CRM infrastructure under
realistic business situations.

This map defines the scenario catalog that should drive the next implementation
plan. The scenarios are synthetic, deterministic, and seeded through
`@orbit-ai/demo-seed` so they can power tests, local examples, and a future
agent/chat demo without depending on live integrations.

## Current Baseline

| Area | Current proof | Gap |
|---|---|---|
| CRUD parity | `e2e/src/journeys/03-05-*` cover contacts, companies, deals across SDK/API/CLI/MCP | Does not prove business workflows across entity graphs |
| Pipeline movement | Journey 6 moves a deal between stages | Does not test stage policy, stalled deals, next actions, or reporting |
| Schema/custom fields | Journey 7 creates a field | Does not test custom field use inside business workflows |
| MCP | Journey 11 invokes core tool subset | Does not prove agent questions or all business-facing tools |
| Integrations | Journeys 12-14 configure credentials/status; Business Journey 6 simulates fake provider events | Does not call live providers |
| Tenant isolation | Journey 15 covers contacts and deals | Does not cover all seeded entities, relationships, schema metadata, and integration records |
| Demo seed | Acme/Beta tenants with realistic rows | No named case-study scenarios or expected business answers |

## Scenario Profiles

### Scenario A: New Lead Qualification

**Implementation status:** Active first slice. Implemented in
`packages/demo-seed/src/scenarios/lead-qualification.ts` with E2E coverage in
`e2e/src/business-journeys/01-lead-qualification.test.ts`.

**Question:** "Which new leads should sales qualify today?"

**Seed state:**
- 5 unqualified contacts tagged `hot-lead`
- 2 have recent inbound email activities
- 1 has no company
- 1 belongs to an enterprise company
- 1 belongs to another tenant and must never appear

**Expected behavior:**
- Query returns only current-tenant contacts.
- Leads with recent inbound activity rank above cold imported leads.
- Missing company is surfaced as a data-quality issue, not a crash.
- Follow-up task creation links to the contact and assigned user.

**Surfaces:** SDK direct helper, SDK HTTP reads/writes. Raw API and MCP remain
follow-ups for this business scenario.

### Scenario B: Stalled Pipeline Review

**Implementation status:** Active second slice. Implemented in
`packages/demo-seed/src/scenarios/stalled-pipeline.ts` with E2E coverage in
`e2e/src/business-journeys/02-stalled-pipeline.test.ts`.

**Question:** "Which deals are stuck and what should I do next?"

**Seed state:**
- Deals distributed across Prospect, Qualified, Proposal, Closed-Won, Closed-Lost
- At least 3 open deals with no activity in 14+ days
- At least 1 high-value proposal with no next task
- At least 1 closed deal that should be excluded

**Expected behavior:**
- Stalled open deals are identified from stage, last activity, and due task state.
- Closed deals are excluded from "stuck" recommendations.
- Moving a deal to Proposal updates stage and is reflected in pipeline stats.
- Creating a next-step task changes the follow-up queue.

**Surfaces:** SDK direct helper and SDK HTTP read/write. MCP
`move_deal_stage`, raw API, and dashboard/reporting remain follow-ups.

### Scenario C: Account 360

**Implementation status:** Active third slice. Implemented in
`packages/demo-seed/src/scenarios/account-360.ts` with E2E coverage in
`e2e/src/business-journeys/03-account-360.test.ts`.

**Question:** "Show me everything important about this company."

**Seed state:**
- One company with multiple contacts, open deals, notes, activities, tags, tasks,
  and optionally payments/contracts when supported by current services
- One similarly named company in the second tenant

**Expected behavior:**
- Account timeline is ordered and tenant-scoped.
- Contacts, deals, activities, notes, and tags can be traversed from company.
- Sensitive fields are redacted from MCP/tool output.
- Cross-tenant similarly named records are excluded.

**Surfaces:** SDK direct graph verification, SDK HTTP graph reads/writes, raw
API company fetch, MCP `get_record`/`search_records`, and Beta tenant exclusion.

### Scenario D: Customer Renewal / Expansion

**Implementation status:** Active fourth slice. Implemented in
`packages/demo-seed/src/scenarios/renewal-expansion.ts` with E2E coverage in
`e2e/src/business-journeys/04-renewal-expansion.test.ts`.

**Question:** "Which customers are likely renewal or expansion opportunities?"

**Seed state:**
- Closed-won deal in prior period
- Recent positive activity or meeting
- Open expansion deal
- Contract/payment record where supported
- Dormant customer with no recent activity as a negative control

**Expected behavior:**
- Renewal/expansion candidates are explainable from CRM facts.
- Payment/contract gaps are surfaced as unknowns if the current entity support is
  incomplete.
- No live Stripe dependency is required in this phase.

**Surfaces:** SDK direct expected answer, SDK HTTP reads/writes, raw API deal
fetch, MCP `get_record`/`search_records`, and Beta tenant exclusion. Fake
integration simulation is covered by Scenario E.

### Scenario E: Integration Event Simulation

**Implementation status:** Active fifth scenario slice. Implemented in
`packages/demo-seed/src/scenarios/integration-events.ts` with E2E coverage in
`e2e/src/business-journeys/06-integration-event-simulation.test.ts`.

**Question:** "What changed after this Gmail/Calendar/Stripe event?"

**Seed state:**
- Fake Gmail thread payload for a known contact
- Fake Calendar event payload for a known contact/company
- Fake Stripe payment event for an existing deal/company

**Expected behavior:**
- Gmail event logs an email activity and links it to the contact.
- Calendar event logs a meeting activity and links it to the company.
- Stripe event creates payment state without leaking credentials.
- Idempotent replay does not duplicate records.

**Surfaces:** demo-seed scenario helper, SDK HTTP reads, SDK direct verification,
and SQLite E2E. Live provider integrations remain out of scope for this pass.

### Scenario F: Agent Q&A Smoke

**Implementation status:** Active sixth scenario slice. Implemented in
`e2e/src/business-journeys/07-agent-qa-smoke.test.ts` using the deterministic
Lead Qualification scenario over MCP tools.

**Question examples:**
- "Which new leads should sales qualify today?"
- "Which deals need attention this week?"
- "Summarize Acme Events' pipeline health."
- "Create a follow-up task for the highest-value stalled deal."
- "Show account history for Bright Harbor Labs."

**Expected behavior:**
- The agent/tool layer returns grounded answers with record IDs.
- Mutating actions are verified by database reads.
- Generated UI payloads, if present, are derived from the same deterministic data.

**Surfaces:** MCP `search_records`, `list_activities`, and `create_record`
with SDK direct persistence verification and Beta tenant exclusion. Future
Next.js/Vercel AI SDK or CopilotKit prototype remains deferred.

## Data Principles

- All data remains synthetic and uses reserved domains/TLDs.
- Scenario records should carry stable semantic markers such as tags or custom
  fields, not hardcoded generated IDs.
- Each scenario must include positive controls, negative controls, and cross-tenant
  trap data.
- Expected answers should be deterministic under a fixed `now`.
- Scenario fixtures should be reusable by tests and a future demo app.

## Recommended Artifact Shape

```
packages/demo-seed/src/scenarios/
├── index.ts
├── lead-qualification.ts
├── stalled-pipeline.ts
├── account-360.ts
├── renewal-expansion.ts
└── integration-events.ts

e2e/src/business-journeys/
├── 01-lead-qualification.test.ts
├── 02-stalled-pipeline.test.ts
├── 03-account-360.test.ts
├── 04-renewal-expansion.test.ts
├── 05-cli-business-surface.test.ts
├── 06-integration-event-simulation.test.ts
└── 07-agent-qa-smoke.test.ts
```

## Phase-One Acceptance Criteria

- First slice complete: `@orbit-ai/demo-seed` exposes
  `seedLeadQualificationScenario()` and `answerLeadQualificationQuestion()`.
- Second slice complete: `@orbit-ai/demo-seed` exposes
  `seedStalledPipelineScenario()` and `answerStalledPipelineQuestion()`.
- Third slice complete: `@orbit-ai/demo-seed` exposes
  `seedAccount360Scenario()` and `answerAccount360Question()`.
- Fourth slice complete: `@orbit-ai/demo-seed` exposes
  `seedRenewalExpansionScenario()` and `answerRenewalExpansionQuestion()`.
- First slice complete: Lead Qualification has deterministic expected-answer
  helpers and semantic record handles.
- First slice complete: Business E2E validates scenario facts through SDK direct
  and SDK HTTP, using SQLite.
- Second slice complete: Stalled Pipeline validates stuck-deal facts, HTTP deal
  movement, HTTP task creation, direct verification, and Beta tenant exclusion
  using SQLite.
- Third slice complete: Account 360 validates company graph traversal across
  contacts, deals, activities, notes, tasks, raw API read, MCP read/search, and
  Beta tenant exclusion using SQLite.
- Fourth slice complete: Renewal/Expansion validates signed contract, paid
  historical deal, recent positive activity, open expansion deal, dormant
  negative-control customer, raw API read, MCP read/search, and Beta tenant
  exclusion using SQLite.
- CLI business-surface smoke complete: representative records from implemented
  scenarios are fetched through CLI API mode.
- Fifth scenario complete: Integration Event Simulation validates fake Gmail,
  Google Calendar, and Stripe event application plus idempotent replay using
  SQLite.
- MCP Agent Q&A smoke complete: Lead Qualification is reconstructed through MCP
  tools, creates a follow-up task through MCP, verifies persistence through SDK
  direct, and excludes Beta tenant records.
- First slice complete: Beta tenant exclusion is asserted for the Lead
  Qualification answer.
- Security slice complete for SQLite controls in this pass: tenant graph
  isolation, CLI graph isolation, auth/scope boundaries, redaction, fake event
  idempotency, payload limits, rate limits, and webhook SSRF all have focused
  E2E files.
- Deferred: generated UI, live integration calls, MCP stdio wire smoke, broader
  natural-language agent orchestration, and Postgres/RLS proof.
