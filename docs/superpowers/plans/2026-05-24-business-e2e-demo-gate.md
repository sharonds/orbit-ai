# Business E2E Demo Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic business-level CRM scenarios and executable E2E journeys that prove Orbit works as useful CRM infrastructure, not only as CRUD/API plumbing.

**Architecture:** Extend `@orbit-ai/demo-seed` with named scenario overlays that are written through existing core services after the base tenant seed. Add a new `e2e/src/business-journeys/` suite that builds the current full stack, applies scenario overlays, asks business questions through SDK/API/MCP where supported, and verifies final database state. Keep UI/chat prototype work out of this phase; this phase creates the scenario contract that a future Vercel AI SDK or CopilotKit demo will consume.

**Tech Stack:** TypeScript, vitest, `@orbit-ai/demo-seed`, `@orbit-ai/core`, `@orbit-ai/sdk`, `@orbit-ai/api`, `@orbit-ai/mcp`, existing `@orbit-ai/e2e` harness.

---

## Scope

This plan implements the first business/demo gate only.

**In scope:**
- Deterministic scenario overlays for lead qualification, stalled pipeline, and account 360.
- Expected-answer helpers so tests do not duplicate business rules ad hoc.
- E2E tests that validate business answers and state changes.
- Cross-tenant trap records in each scenario.
- Documentation updates for what is proved and what remains deferred.

**Out of scope:**
- Live Gmail, Calendar, or Stripe provider calls.
- Public UI, generated UI, Vercel deployment, or CopilotKit integration.
- Real migration-engine safety semantics.
- Restricted-role Postgres RLS proof.

## File Structure

```
packages/demo-seed/src/scenarios/
├── index.ts                         # scenario exports
├── types.ts                         # ScenarioSeedResult and shared helpers
├── lead-qualification.ts            # lead qualification overlay + expectations
├── stalled-pipeline.ts              # stalled deal overlay + expectations
└── account-360.ts                   # company graph overlay + expectations

packages/demo-seed/src/scenarios/*.test.ts

e2e/src/business-journeys/
├── 01-lead-qualification.test.ts
├── 02-stalled-pipeline.test.ts
└── 03-account-360.test.ts

docs/product/business-e2e-scenario-map.md
docs/testing/security-e2e-matrix.md
packages/demo-seed/README.md
e2e/README.md
```

No existing seed behavior should change unless callers explicitly invoke the new scenario helpers.

## Design Rules

- Scenario helpers accept existing `StorageAdapter` and `organizationId`.
- Scenario helpers write through `createCoreServices(adapter)` rather than raw SQL.
- Do not hardcode generated IDs in expected assertions. Return semantic handles from the scenario helper.
- Use stable emails, names, tags, and custom field values to locate scenario records.
- Every scenario must include a cross-tenant negative control when `buildStack({ tenant: 'both' })` is used.
- Use a fixed `now` in tests.

## Task 1: Add Scenario Types and Barrel Exports

**Files:**
- Create: `packages/demo-seed/src/scenarios/types.ts`
- Create: `packages/demo-seed/src/scenarios/index.ts`
- Modify: `packages/demo-seed/src/index.ts`

- [ ] **Step 1: Create shared scenario types**

Create `packages/demo-seed/src/scenarios/types.ts`:

```typescript
import type { StorageAdapter } from '@orbit-ai/core'

export interface ScenarioSeedOptions {
  readonly adapter: StorageAdapter
  readonly organizationId: string
  readonly now: number
}

export interface ScenarioRecordRef {
  readonly id: string
  readonly label: string
}

export interface ScenarioSeedResult {
  readonly scenario: string
  readonly organizationId: string
  readonly records: Record<string, ScenarioRecordRef>
  readonly expected: Record<string, unknown>
}

export function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}
```

- [ ] **Step 2: Create scenario barrel**

Create `packages/demo-seed/src/scenarios/index.ts`:

```typescript
export type { ScenarioSeedOptions, ScenarioSeedResult, ScenarioRecordRef } from './types.js'
export { isoDaysAgo } from './types.js'
export { seedLeadQualificationScenario, expectedLeadQualificationAnswer } from './lead-qualification.js'
export { seedStalledPipelineScenario, expectedStalledPipelineAnswer } from './stalled-pipeline.js'
export { seedAccount360Scenario, expectedAccount360Answer } from './account-360.js'
```

- [ ] **Step 3: Export scenarios from package root**

Modify `packages/demo-seed/src/index.ts`:

```typescript
export * from './scenarios/index.js'
```

Keep existing exports unchanged.

- [ ] **Step 4: Typecheck**

Run: `pnpm -F @orbit-ai/demo-seed typecheck`

Expected: pass.

## Task 2: Lead Qualification Scenario

**Files:**
- Create: `packages/demo-seed/src/scenarios/lead-qualification.ts`
- Create: `packages/demo-seed/src/scenarios/lead-qualification.test.ts`

- [ ] **Step 1: Implement scenario overlay**

Create `packages/demo-seed/src/scenarios/lead-qualification.ts`:

```typescript
import { createCoreServices } from '@orbit-ai/core'
import type { ContactRecord, StorageAdapter } from '@orbit-ai/core'
import type { ScenarioSeedOptions, ScenarioSeedResult } from './types.js'
import { isoDaysAgo } from './types.js'

export interface LeadQualificationAnswer {
  readonly contactIds: string[]
  readonly missingCompanyContactIds: string[]
}

export async function seedLeadQualificationScenario(opts: ScenarioSeedOptions): Promise<ScenarioSeedResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }

  const userPage = await services.users.list(ctx, { limit: 1 })
  const owner = userPage.data[0]
  if (!owner) throw new Error('lead-qualification scenario requires at least one seeded user')

  const company = await services.companies.create(ctx, {
    name: 'Scenario Enterprise Labs',
    domain: 'scenario-enterprise.test',
  })

  const hotWithActivity = await services.contacts.create(ctx, {
    name: 'Lena Qualification',
    email: 'lena.qualification@example.test',
    companyId: company.id,
    status: 'lead',
  })
  const hotEnterprise = await services.contacts.create(ctx, {
    name: 'Marco Enterprise',
    email: 'marco.enterprise@example.test',
    companyId: company.id,
    status: 'lead',
  })
  const missingCompany = await services.contacts.create(ctx, {
    name: 'No Company Lead',
    email: 'no-company-lead@example.test',
    status: 'lead',
  })
  const coldLead = await services.contacts.create(ctx, {
    name: 'Cold Imported Lead',
    email: 'cold-imported-lead@example.test',
    companyId: company.id,
    status: 'lead',
  })

  const tag = await services.tags.create(ctx, { name: 'scenario:lead-qualification' })
  for (const contact of [hotWithActivity, hotEnterprise, missingCompany, coldLead]) {
    await services.tags.attach(ctx, tag.id, 'contacts', contact.id)
  }

  await services.activities.create(ctx, {
    contactId: hotWithActivity.id,
    type: 'email',
    subject: 'Inbound qualification request',
    body: 'Prospect asked for pricing and implementation timeline.',
    occurredAt: isoDaysAgo(opts.now, 1),
  })
  await services.activities.create(ctx, {
    contactId: hotEnterprise.id,
    type: 'email',
    subject: 'Enterprise buying committee',
    body: 'Prospect confirmed budget and decision date.',
    occurredAt: isoDaysAgo(opts.now, 2),
  })
  await services.tasks.create(ctx, {
    title: 'Qualify Lena Qualification',
    contactId: hotWithActivity.id,
    assignedToUserId: owner.id,
    dueAt: isoDaysAgo(opts.now, -1),
    status: 'open',
  })

  return {
    scenario: 'lead-qualification',
    organizationId: opts.organizationId,
    records: {
      company: { id: company.id, label: company.name },
      hotWithActivity: { id: hotWithActivity.id, label: hotWithActivity.email },
      hotEnterprise: { id: hotEnterprise.id, label: hotEnterprise.email },
      missingCompany: { id: missingCompany.id, label: missingCompany.email },
      coldLead: { id: coldLead.id, label: coldLead.email },
      tag: { id: tag.id, label: tag.name },
    },
    expected: expectedLeadQualificationAnswer([hotWithActivity, hotEnterprise, missingCompany]),
  }
}

export function expectedLeadQualificationAnswer(contacts: ContactRecord[]): LeadQualificationAnswer {
  return {
    contactIds: contacts.map((contact) => contact.id),
    missingCompanyContactIds: contacts.filter((contact) => !contact.companyId).map((contact) => contact.id),
  }
}

export async function answerLeadQualificationQuestion(
  adapter: StorageAdapter,
  organizationId: string,
): Promise<LeadQualificationAnswer> {
  const services = createCoreServices(adapter)
  const ctx = { orgId: organizationId }
  const contacts = await services.contacts.search(ctx, {
    filter: { status: 'lead' },
    limit: 100,
  })
  const scenarioContacts = contacts.filter((contact) =>
    [
      'lena.qualification@example.test',
      'marco.enterprise@example.test',
      'no-company-lead@example.test',
    ].includes(contact.email ?? ''),
  )
  return expectedLeadQualificationAnswer(scenarioContacts)
}
```

If `services.contacts.search` is not available with this exact signature, use the existing list/search method from the contact service and keep the predicate in memory inside this helper.

- [ ] **Step 2: Add unit test**

Create `packages/demo-seed/src/scenarios/lead-qualification.test.ts` that builds an in-memory SQLite adapter, runs base `seed()`, applies `seedLeadQualificationScenario()`, and asserts expected IDs are returned by `answerLeadQualificationQuestion()`.

- [ ] **Step 3: Run focused test**

Run: `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/lead-qualification.test.ts`

Expected: pass.

## Task 3: Stalled Pipeline Scenario

**Files:**
- Create: `packages/demo-seed/src/scenarios/stalled-pipeline.ts`
- Create: `packages/demo-seed/src/scenarios/stalled-pipeline.test.ts`

- [ ] **Step 1: Implement scenario overlay**

Create a helper that:
- Finds the seeded pipeline and stages.
- Creates 3 open deals older than 14 days with no recent activity.
- Creates 1 high-value proposal deal with no open task.
- Creates 1 closed-won deal as a negative control.
- Returns expected stalled deal IDs.

Use only existing core services. If a `createdAt` override is not supported by
the public create payload, use old `occurredAt` activity dates and missing tasks
as the primary stalled signal.

- [ ] **Step 2: Add expected-answer helper**

Export:

```typescript
export interface StalledPipelineAnswer {
  readonly stalledDealIds: string[]
  readonly highValueNoTaskDealIds: string[]
}
```

The helper should compute from deterministic scenario record handles, not from
all random base seed deals.

- [ ] **Step 3: Add unit test**

Test that closed-won control is excluded and all open stalled handles are
included.

- [ ] **Step 4: Run focused test**

Run: `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/stalled-pipeline.test.ts`

Expected: pass.

## Task 4: Account 360 Scenario

**Files:**
- Create: `packages/demo-seed/src/scenarios/account-360.ts`
- Create: `packages/demo-seed/src/scenarios/account-360.test.ts`

- [ ] **Step 1: Implement scenario overlay**

Create a company named `Scenario Account 360 Corp` with:
- 2 contacts
- 2 deals
- 2 notes
- 3 activities
- 1 open task
- 2 tags

Return all record IDs as semantic handles.

- [ ] **Step 2: Add answer helper**

Export:

```typescript
export interface Account360Answer {
  readonly companyId: string
  readonly contactIds: string[]
  readonly dealIds: string[]
  readonly activityCount: number
  readonly noteCount: number
  readonly openTaskIds: string[]
  readonly tagIds: string[]
}
```

- [ ] **Step 3: Add unit test**

Test that the helper returns the complete graph for the scenario company and no
records from another company.

- [ ] **Step 4: Run focused test**

Run: `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/account-360.test.ts`

Expected: pass.

## Task 5: Add Business E2E Journey Harness Helper

**Files:**
- Create: `e2e/src/business-journeys/scenario-harness.ts`

- [ ] **Step 1: Create helper**

Create `buildBusinessScenarioStack()` that wraps existing `buildStack()` and
applies a scenario overlay:

```typescript
import { buildStack } from '../harness/build-stack.js'
import type { Stack } from '../harness/build-stack.js'
import type { ScenarioSeedResult } from '@orbit-ai/demo-seed'

export interface BusinessScenarioStack {
  readonly stack: Stack
  readonly scenario: ScenarioSeedResult
  readonly teardown: () => Promise<void>
}

export async function buildBusinessScenarioStack(
  seedScenario: (input: { adapter: Stack['adapter']; organizationId: string; now: number }) => Promise<ScenarioSeedResult>,
): Promise<BusinessScenarioStack> {
  const stack = await buildStack({
    tenant: 'both',
    adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres',
  })
  const now = Date.UTC(2026, 3, 15, 12, 0, 0)
  try {
    const scenario = await seedScenario({
      adapter: stack.adapter,
      organizationId: stack.acmeOrgId,
      now,
    })
    return {
      stack,
      scenario,
      teardown: stack.teardown,
    }
  } catch (err) {
    await stack.teardown()
    throw err
  }
}
```

- [ ] **Step 2: Typecheck e2e**

Run: `pnpm -F @orbit-ai/e2e typecheck`

Expected: pass.

## Task 6: Lead Qualification Business Journey

**Files:**
- Create: `e2e/src/business-journeys/01-lead-qualification.test.ts`

- [ ] **Step 1: Add E2E test**

The test should:
- Build both tenants.
- Apply `seedLeadQualificationScenario()` to Acme only.
- Ask `answerLeadQualificationQuestion()` through direct services.
- Verify SDK HTTP can fetch every expected contact ID.
- Verify a Beta-bound direct client cannot see those Acme-only handles when
  inverted, and Acme cannot see Beta trap handles if the scenario adds them.
- Create a follow-up task through SDK HTTP and verify it through SDK direct.

- [ ] **Step 2: Run focused journey**

Run: `pnpm -F @orbit-ai/e2e test -- src/business-journeys/01-lead-qualification.test.ts`

Expected: pass.

## Task 7: Stalled Pipeline Business Journey

**Files:**
- Create: `e2e/src/business-journeys/02-stalled-pipeline.test.ts`

- [ ] **Step 1: Add E2E test**

The test should:
- Apply `seedStalledPipelineScenario()`.
- Verify stalled deals through direct helper.
- Move one stalled deal to the Proposal stage through SDK HTTP or MCP.
- Verify the moved deal stage through SDK direct.
- Create a next-step task and assert the high-value-no-task list changes.

- [ ] **Step 2: Run focused journey**

Run: `pnpm -F @orbit-ai/e2e test -- src/business-journeys/02-stalled-pipeline.test.ts`

Expected: pass.

## Task 8: Account 360 Business Journey

**Files:**
- Create: `e2e/src/business-journeys/03-account-360.test.ts`

- [ ] **Step 1: Add E2E test**

The test should:
- Apply `seedAccount360Scenario()`.
- Resolve the account graph through SDK direct.
- Fetch the company and contacts through SDK HTTP.
- Use MCP `get_record` and `search_records` for at least one graph lookup.
- Assert no Beta company/contact/deal IDs appear in the graph.

- [ ] **Step 2: Run focused journey**

Run: `pnpm -F @orbit-ai/e2e test -- src/business-journeys/03-account-360.test.ts`

Expected: pass.

## Task 9: Documentation Updates

**Files:**
- Modify: `packages/demo-seed/README.md`
- Modify: `e2e/README.md`
- Modify: `docs/product/business-e2e-scenario-map.md`
- Modify: `docs/testing/security-e2e-matrix.md`

- [ ] **Step 1: Document scenario API**

Add a `Business scenarios` section to `packages/demo-seed/README.md` with:
- The three helper names.
- A warning that they are deterministic demo overlays.
- A short example using `seed()` followed by a scenario helper.

- [ ] **Step 2: Document E2E commands**

Add to `e2e/README.md`:

```bash
pnpm -F @orbit-ai/e2e test -- src/business-journeys
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=... pnpm -F @orbit-ai/e2e test -- src/business-journeys
```

- [ ] **Step 3: Update scenario/security docs**

Mark implemented phase-one scenarios as active and keep integration simulation,
agent UI, and restricted-role RLS in deferred status.

## Task 10: Verification

**Files:** none

- [ ] **Step 1: Run demo-seed tests**

Run: `pnpm -F @orbit-ai/demo-seed test`

Expected: pass.

- [ ] **Step 2: Run E2E business journeys**

Run: `pnpm -F @orbit-ai/e2e test -- src/business-journeys`

Expected: pass.

- [ ] **Step 3: Run typechecks**

Run: `pnpm -F @orbit-ai/demo-seed typecheck && pnpm -F @orbit-ai/e2e typecheck`

Expected: pass.

- [ ] **Step 4: Run full release-adjacent check if time allows**

Run: `pnpm -r build && pnpm -r test`

Expected: pass. If this is too slow locally, record the skipped command in the final handoff and run the focused checks above.

## Handoff to Next Phase

After this plan lands, the next plan should build a demo/chat UI on top of these
scenario contracts. Candidate surfaces:
- A minimal Next.js app using Vercel AI SDK for chat.
- A CopilotKit/OpenGenerativeUI prototype for generated CRM panels.
- A static case-study flow that runs against the deterministic scenario seed.

The UI must consume these scenario helpers rather than inventing separate mock data.
