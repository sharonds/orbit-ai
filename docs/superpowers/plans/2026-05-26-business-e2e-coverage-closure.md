# Business E2E Coverage Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining business E2E coverage gaps with deterministic SQLite tests before moving to any UI, deployment, or live integration work.

**Architecture:** Keep coverage in the existing E2E harness and demo-seed scenario model. Add focused tests that prove one control each, with small reusable helpers only when they reduce duplication across security files. Use SQLite by default and keep Postgres/RLS as an explicitly separate optional gate.

**Tech Stack:** TypeScript, Vitest, `@orbit-ai/demo-seed`, `@orbit-ai/e2e`, `@orbit-ai/sdk`, `@orbit-ai/api`, `@orbit-ai/mcp`, SQLite adapter.

---

## Scope

This plan closes the coverage gaps currently documented in:

- `docs/reports/2026-05-26-business-e2e-review-report.md`
- `docs/testing/security-e2e-matrix.md`
- `docs/product/business-e2e-scenario-map.md`
- `e2e/README.md`

In scope:

- Fake Gmail/Calendar/Stripe event simulation without live providers.
- Idempotent replay checks for simulated events.
- Broader security E2E coverage for auth, scope, redaction, payload limits, rate limits, and webhook SSRF.
- CLI graph isolation beyond contacts/deals.
- MCP stdio wire smoke.
- Documentation/report updates.

Out of scope:

- UI prototype.
- Vercel deployment.
- OrbStack/Postgres requirement for the default path.
- Live Gmail/Calendar/Stripe network calls.
- Full production Postgres/RLS certification unless a safe restricted-role harness already exists.

## File Map

Create:

- `packages/demo-seed/src/scenarios/integration-events.ts`
- `packages/demo-seed/src/scenarios/integration-events.test.ts`
- `e2e/src/business-journeys/06-integration-event-simulation.test.ts`
- `e2e/src/security/auth-boundary.test.ts`
- `e2e/src/security/redaction.test.ts`
- `e2e/src/security/payload-limit.test.ts`
- `e2e/src/security/rate-limit.test.ts`
- `e2e/src/security/webhook-ssrf.test.ts`
- `e2e/src/security/cli-graph-isolation.test.ts`
- `e2e/src/security/mcp-stdio-smoke.test.ts`
- `e2e/src/security/helpers.ts`
- `docs/reports/2026-05-26-business-e2e-coverage-closure-report.md`

Modify:

- `packages/demo-seed/src/scenarios/index.ts`
- `packages/demo-seed/src/index.ts` only if the scenario barrel is not already exported.
- `packages/demo-seed/README.md`
- `e2e/README.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/testing/security-e2e-matrix.md`
- `docs/reports/2026-05-26-business-e2e-review-report.md`
- `CHANGELOG.md`
- `.gitignore` only if the new report path is not trackable.

Do not modify:

- Production integration connectors unless a test reveals an actual bug.
- Core schema/migrations unless an existing API cannot represent the required deterministic fake state.

---

## Task 1: Shared Security E2E Helpers

**Files:**
- Create: `e2e/src/security/helpers.ts`
- Test through consumers in later tasks.

- [ ] **Step 1: Create helper file**

Add:

```ts
import { expect } from 'vitest'
import type { Stack } from '../harness/build-stack.js'

export const API_VERSION = '2026-04-01'

export function apiHeaders(rawApiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${rawApiKey}`,
    'Orbit-Version': API_VERSION,
    'content-type': 'application/json',
  }
}

export async function rawApi(
  stack: Stack,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return stack.api.fetch(new Request(`http://test.local/v1/${path}`, {
    ...init,
    headers: {
      ...apiHeaders(stack.rawApiKey),
      ...(init.headers ?? {}),
    },
  }))
}

export async function expectApiError(
  response: Response,
  input: { status: number; code: string; label: string },
): Promise<void> {
  expect(response.status, `${input.label} status`).toBe(input.status)
  const envelope = (await response.json()) as { error?: { code?: string } }
  expect(envelope.error?.code, `${input.label} code`).toBe(input.code)
}

export async function expectRawApiNotFound(
  stack: Stack,
  entity: string,
  id: string,
): Promise<void> {
  await expectApiError(await rawApi(stack, `${entity}/${id}`), {
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    label: `raw-api ${entity}/${id}`,
  })
}

export function unwrapData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const data = record.data
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return record
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/src/security/helpers.ts
git commit -m "test: add security e2e helpers"
```

---

## Task 2: Integration Event Scenario

**Files:**
- Create: `packages/demo-seed/src/scenarios/integration-events.ts`
- Create: `packages/demo-seed/src/scenarios/integration-events.test.ts`
- Modify: `packages/demo-seed/src/scenarios/index.ts`

- [ ] **Step 1: Add failing package test**

Create `packages/demo-seed/src/scenarios/integration-events.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '../index.js'
import {
  applyFakeCalendarEvent,
  applyFakeGmailThread,
  applyFakeStripePaymentEvent,
  seedIntegrationEventsScenario,
} from './integration-events.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('integration events scenario', () => {
  it('applies fake Gmail, Calendar, and Stripe events idempotently', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()

    try {
      const base = await seed(adapter, {
        profile: TENANT_PROFILES.acme,
        now: fixedNow,
      })
      const scenario = await seedIntegrationEventsScenario({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      const gmailFirst = await applyFakeGmailThread({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })
      const gmailReplay = await applyFakeGmailThread({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })
      expect(gmailReplay.activity.id).toBe(gmailFirst.activity.id)
      expect(gmailReplay.created).toBe(false)

      const calendarFirst = await applyFakeCalendarEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })
      const calendarReplay = await applyFakeCalendarEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })
      expect(calendarReplay.activity.id).toBe(calendarFirst.activity.id)
      expect(calendarReplay.created).toBe(false)

      const stripeFirst = await applyFakeStripePaymentEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })
      const stripeReplay = await applyFakeStripePaymentEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })
      expect(stripeReplay.payment.id).toBe(stripeFirst.payment.id)
      expect(stripeReplay.created).toBe(false)

      expect(gmailFirst.activity.contactId).toBe(scenario.records.contact.id)
      expect(calendarFirst.activity.companyId).toBe(scenario.records.company.id)
      expect(stripeFirst.payment.dealId).toBe(scenario.records.deal.id)
    } finally {
      await adapter.disconnect()
    }
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm -F @orbit-ai/demo-seed test -- src/scenarios/integration-events.test.ts
```

Expected: FAIL because `integration-events.js` does not exist.

- [ ] **Step 3: Implement scenario**

Create `packages/demo-seed/src/scenarios/integration-events.ts` with:

```ts
import { createCoreServices } from '@orbit-ai/core'
import type { ScenarioRecordRef, ScenarioSeedOptions } from './types.js'
import { dateDaysAgo } from './types.js'

const SCENARIO = 'integration-events'

export interface FakeGmailThreadEvent {
  readonly provider: 'gmail'
  readonly externalId: string
  readonly from: string
  readonly subject: string
  readonly body: string
}

export interface FakeCalendarEvent {
  readonly provider: 'google-calendar'
  readonly externalId: string
  readonly summary: string
  readonly description: string
}

export interface FakeStripePaymentEvent {
  readonly provider: 'stripe'
  readonly externalId: string
  readonly amount: string
}

export interface IntegrationEventsScenarioResult {
  readonly scenario: typeof SCENARIO
  readonly organizationId: string
  readonly records: {
    readonly owner: ScenarioRecordRef
    readonly company: ScenarioRecordRef
    readonly contact: ScenarioRecordRef
    readonly deal: ScenarioRecordRef
  }
  readonly events: {
    readonly gmailThread: FakeGmailThreadEvent
    readonly calendarEvent: FakeCalendarEvent
    readonly stripePayment: FakeStripePaymentEvent
  }
}

export async function seedIntegrationEventsScenario(
  opts: ScenarioSeedOptions,
): Promise<IntegrationEventsScenarioResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }
  const owner = (await services.users.list(ctx, { limit: 1 })).data[0]
  if (!owner) throw new Error('integration-events scenario requires at least one seeded user')
  const pipeline = (await services.pipelines.list(ctx, { limit: 1 })).data[0]
  if (!pipeline) throw new Error('integration-events scenario requires a seeded pipeline')
  const stage = (await services.stages.list(ctx, {
    limit: 100,
    filter: { pipeline_id: pipeline.id },
  })).data.find((candidate) => candidate.name === 'Proposal')
  if (!stage) throw new Error('integration-events scenario requires Proposal stage')

  const company = await services.companies.create(ctx, {
    name: 'Scenario Integration Events Co',
    domain: 'scenario-integration-events.test',
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const contact = await services.contacts.create(ctx, {
    name: 'Iris Integration',
    email: 'iris.integration@example.test',
    status: 'customer',
    companyId: company.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const deal = await services.deals.create(ctx, {
    title: 'Scenario Integration Events Deal',
    value: '18000.00',
    currency: 'USD',
    status: 'open',
    pipelineId: pipeline.id,
    stageId: stage.id,
    companyId: company.id,
    contactId: contact.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  return {
    scenario: SCENARIO,
    organizationId: opts.organizationId,
    records: {
      owner: { id: owner.id, label: owner.email },
      company: { id: company.id, label: company.name },
      contact: { id: contact.id, label: contact.email ?? contact.name },
      deal: { id: deal.id, label: deal.title },
    },
    events: {
      gmailThread: {
        provider: 'gmail',
        externalId: 'gmail_thread_scenario_integration_events',
        from: contact.email ?? 'iris.integration@example.test',
        subject: 'Integration event inbound request',
        body: 'Please attach this Gmail thread to the account.',
      },
      calendarEvent: {
        provider: 'google-calendar',
        externalId: 'calendar_event_scenario_integration_events',
        summary: 'Integration event account meeting',
        description: 'Calendar meeting should become a CRM activity.',
      },
      stripePayment: {
        provider: 'stripe',
        externalId: 'pi_scenario_integration_events',
        amount: '18000.00',
      },
    },
  }
}

export async function applyFakeGmailThread(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
  readonly event: FakeGmailThreadEvent
}) {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const existing = (await services.activities.list(ctx, {
    limit: 10,
    filter: { external_id: input.event.externalId },
  })).data[0]
  if (existing) return { activity: existing, created: false }
  const contact = (await services.contacts.list(ctx, {
    limit: 10,
    filter: { email: input.event.from },
  })).data[0]
  if (!contact) throw new Error(`No contact for Gmail event ${input.event.externalId}`)
  const activity = await services.activities.create(ctx, {
    type: 'email',
    subject: input.event.subject,
    body: input.event.body,
    direction: 'inbound',
    contactId: contact.id,
    companyId: contact.companyId,
    occurredAt: dateDaysAgo(input.now, 0),
    externalId: input.event.externalId,
    customFields: { scenario: SCENARIO, provider: input.event.provider },
  })
  return { activity, created: true }
}

export async function applyFakeCalendarEvent(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
  readonly event: FakeCalendarEvent
}) {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const existing = (await services.activities.list(ctx, {
    limit: 10,
    filter: { external_id: input.event.externalId },
  })).data[0]
  if (existing) return { activity: existing, created: false }
  const company = (await services.companies.list(ctx, {
    limit: 10,
    filter: { domain: 'scenario-integration-events.test' },
  })).data[0]
  if (!company) throw new Error(`No company for Calendar event ${input.event.externalId}`)
  const activity = await services.activities.create(ctx, {
    type: 'meeting',
    subject: input.event.summary,
    body: input.event.description,
    direction: 'outbound',
    companyId: company.id,
    occurredAt: dateDaysAgo(input.now, 0),
    externalId: input.event.externalId,
    customFields: { scenario: SCENARIO, provider: input.event.provider },
  })
  return { activity, created: true }
}

export async function applyFakeStripePaymentEvent(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
  readonly event: FakeStripePaymentEvent
}) {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const existing = (await services.payments.list(ctx, {
    limit: 10,
    filter: { external_id: input.event.externalId },
  })).data[0]
  if (existing) return { payment: existing, created: false }
  const deal = (await services.deals.list(ctx, {
    limit: 10,
    filter: { title: 'Scenario Integration Events Deal' },
  })).data[0]
  if (!deal) throw new Error(`No deal for Stripe event ${input.event.externalId}`)
  const payment = await services.payments.create(ctx, {
    amount: input.event.amount,
    currency: 'USD',
    status: 'paid',
    paidAt: dateDaysAgo(input.now, 0),
    dealId: deal.id,
    contactId: deal.contactId,
    externalId: input.event.externalId,
    customFields: { scenario: SCENARIO, provider: input.event.provider },
  })
  return { payment, created: true }
}
```

If `activities.list` or other services do not support `external_id`, replace the lookup with paginated list filtered by `customFields.providerExternalId` and store that field on created records. Do not use raw SQL.

- [ ] **Step 4: Export scenario**

Modify `packages/demo-seed/src/scenarios/index.ts`:

```ts
export {
  applyFakeCalendarEvent,
  applyFakeGmailThread,
  applyFakeStripePaymentEvent,
  seedIntegrationEventsScenario,
} from './integration-events.js'
export type {
  FakeCalendarEvent,
  FakeGmailThreadEvent,
  FakeStripePaymentEvent,
  IntegrationEventsScenarioResult,
} from './integration-events.js'
```

- [ ] **Step 5: Run package verification**

Run:

```bash
pnpm -F @orbit-ai/demo-seed test -- src/scenarios/integration-events.test.ts
pnpm -F @orbit-ai/demo-seed typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/demo-seed/src/scenarios/integration-events.ts packages/demo-seed/src/scenarios/integration-events.test.ts packages/demo-seed/src/scenarios/index.ts
git commit -m "test: add integration event scenario"
```

---

## Task 3: Integration Event Business Journey

**Files:**
- Create: `e2e/src/business-journeys/06-integration-event-simulation.test.ts`

- [ ] **Step 1: Write E2E**

Create:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyFakeCalendarEvent,
  applyFakeGmailThread,
  applyFakeStripePaymentEvent,
  seedIntegrationEventsScenario,
} from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Business Journey 6 — fake integration event simulation', () => {
  it('applies fake provider events and rejects duplicate replay', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })

    try {
      expect(stack.betaOrgId).toBeTruthy()
      const scenario = await seedIntegrationEventsScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })

      const gmail = await applyFakeGmailThread({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })
      const calendar = await applyFakeCalendarEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })
      const stripe = await applyFakeStripePaymentEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })

      expect((await stack.sdkHttp.activities.get(gmail.activity.id)).id).toBe(gmail.activity.id)
      expect((await stack.sdkHttp.activities.get(calendar.activity.id)).id).toBe(calendar.activity.id)
      expect((await stack.sdkHttp.payments.get(stripe.payment.id)).id).toBe(stripe.payment.id)

      expect((await applyFakeGmailThread({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })).created).toBe(false)
      expect((await applyFakeCalendarEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })).created).toBe(false)
      expect((await applyFakeStripePaymentEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })).created).toBe(false)

      await expect(stack.sdkDirect.payments.get(stripe.payment.id)).resolves.toMatchObject({
        id: stripe.payment.id,
        deal_id: scenario.records.deal.id,
      })
    } finally {
      await stack.teardown()
    }
  })
})
```

- [ ] **Step 2: Run focused journey**

Run:

```bash
pnpm -F @orbit-ai/demo-seed build
pnpm -F @orbit-ai/e2e test -- src/business-journeys/06-integration-event-simulation.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/src/business-journeys/06-integration-event-simulation.test.ts
git commit -m "test: add fake integration event journey"
```

---

## Task 4: CLI Graph Isolation

**Files:**
- Create: `e2e/src/security/cli-graph-isolation.test.ts`

- [ ] **Step 1: Write test**

Create a test that seeds Account 360 in Beta, starts the API server with Acme key, and asserts CLI API mode cannot read Beta IDs:

```ts
import { describe, expect, it } from 'vitest'
import { answerAccount360Question, seedAccount360Scenario } from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'
import { startApiServer, type StartedApiServer } from '../harness/api-server.js'
import { runCli } from '../harness/run-cli.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Security — CLI graph isolation', () => {
  it('does not expose Beta Account 360 graph IDs through Acme CLI API mode', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })
    let server: StartedApiServer | undefined
    try {
      expect(stack.betaOrgId).toBeTruthy()
      await seedAccount360Scenario({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
        now: fixedNow,
      })
      const betaAnswer = await answerAccount360Question({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
      })
      server = await startApiServer(stack.api)
      const env = {
        ORBIT_BASE_URL: server.baseUrl,
        ORBIT_API_KEY: stack.rawApiKey,
      }
      for (const [entity, id] of [
        ['companies', betaAnswer.companyId],
        ['contacts', betaAnswer.contactIds[0]!],
        ['deals', betaAnswer.openDealIds[0]!],
        ['activities', betaAnswer.activityIds[0]!],
        ['notes', betaAnswer.noteIds[0]!],
        ['tasks', betaAnswer.openTaskIds[0]!],
      ] as const) {
        const result = await runCli({
          args: ['--mode', 'api', '--json', entity, 'get', id],
          cwd: process.cwd(),
          env,
        })
        expect(result.exitCode, `cli ${entity} ${id}`).not.toBe(0)
        expect(result.stdout + result.stderr, `cli ${entity} ${id}`).toContain('RESOURCE_NOT_FOUND')
      }
    } finally {
      if (server) await server.close()
      await stack.teardown()
    }
  })
})
```

- [ ] **Step 2: Run test**

Run:

```bash
pnpm -F @orbit-ai/e2e test -- src/security/cli-graph-isolation.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/src/security/cli-graph-isolation.test.ts
git commit -m "test: add cli graph isolation smoke"
```

---

## Task 5: Auth And Scope Boundary Expansion

**Files:**
- Create: `e2e/src/security/auth-boundary.test.ts`
- Modify: `e2e/src/security/scope-boundary.test.ts`

- [ ] **Step 1: Add auth-boundary test**

Create `e2e/src/security/auth-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError } from './helpers.js'

describe('Security — auth boundary', () => {
  it('rejects missing and invalid API keys without writing data', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      await expectApiError(await stack.api.fetch(new Request('http://test.local/v1/contacts')), {
        status: 401,
        code: 'AUTH_INVALID_API_KEY',
        label: 'missing auth',
      })
      await expectApiError(await stack.api.fetch(new Request('http://test.local/v1/contacts', {
        headers: {
          Authorization: 'Bearer sk_test_invalid',
          'Orbit-Version': '2026-04-01',
        },
      })), {
        status: 401,
        code: 'AUTH_INVALID_API_KEY',
        label: 'invalid auth',
      })
    } finally {
      await stack.teardown()
    }
  })
})
```

- [ ] **Step 2: Expand scope-boundary test**

Modify `e2e/src/security/scope-boundary.test.ts` to include update and delete attempts:

```ts
const contactUpdate = await rawApi(stack, `contacts/${contactId}`, {
  method: 'PATCH',
  body: JSON.stringify({ name: 'Scope Boundary Should Not Update' }),
})
await expectScopeError(contactUpdate, 'contacts:update rejected')

const contactDelete = await rawApi(stack, `contacts/${contactId}`, {
  method: 'DELETE',
})
await expectScopeError(contactDelete, 'contacts:delete rejected')
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm -F @orbit-ai/e2e test -- src/security/auth-boundary.test.ts src/security/scope-boundary.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/src/security/auth-boundary.test.ts e2e/src/security/scope-boundary.test.ts
git commit -m "test: expand auth and scope boundaries"
```

---

## Task 6: Redaction Coverage

**Files:**
- Create: `e2e/src/security/redaction.test.ts`

- [ ] **Step 1: Write redaction test**

Create a test that runs existing connector status surfaces and asserts known secret sentinels are absent:

```ts
import { describe, expect, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { startApiServer, type StartedApiServer } from '../harness/api-server.js'
import { runCli } from '../harness/run-cli.js'

const SECRET_SENTINELS = [
  'gmail_refresh_secret',
  'calendar_refresh_secret',
  'sk_test_scope_should_not_leak',
]

describe('Security — redaction', () => {
  it('does not expose credential sentinels in CLI status output', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    let server: StartedApiServer | undefined
    try {
      server = await startApiServer(stack.api)
      const env = {
        ORBIT_BASE_URL: server.baseUrl,
        ORBIT_API_KEY: stack.rawApiKey,
        GMAIL_REFRESH_TOKEN: SECRET_SENTINELS[0]!,
        CALENDAR_REFRESH_TOKEN: SECRET_SENTINELS[1]!,
        STRIPE_API_KEY: SECRET_SENTINELS[2]!,
      }
      const outputs: string[] = []
      outputs.push((await runCli({
        args: ['--mode', 'api', '--json', 'integrations', 'gmail', 'status'],
        cwd: process.cwd(),
        env,
      })).stdout)
      outputs.push((await runCli({
        args: ['--mode', 'api', '--json', 'integrations', 'google-calendar', 'status'],
        cwd: process.cwd(),
        env,
      })).stdout)
      outputs.push((await runCli({
        args: ['--mode', 'api', '--json', 'integrations', 'stripe', 'status'],
        cwd: process.cwd(),
        env,
      })).stdout)
      const joined = outputs.join('\n')
      for (const secret of SECRET_SENTINELS) {
        expect(joined).not.toContain(secret)
      }
    } finally {
      if (server) await server.close()
      await stack.teardown()
    }
  })
})
```

If existing CLI commands require prior configure calls, add configure calls with `--skip-validation` and env-var based secrets. Do not pass raw secrets in argv.

- [ ] **Step 2: Run focused test**

Run:

```bash
pnpm -F @orbit-ai/e2e test -- src/security/redaction.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/src/security/redaction.test.ts
git commit -m "test: add credential redaction smoke"
```

---

## Task 7: Payload Limit And Rate Limit Coverage

**Files:**
- Create: `e2e/src/security/payload-limit.test.ts`
- Create: `e2e/src/security/rate-limit.test.ts`

- [ ] **Step 1: Add payload-limit test**

Create `e2e/src/security/payload-limit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError, rawApi } from './helpers.js'

describe('Security — payload limit', () => {
  it('rejects oversized note bodies without writing', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      const oversized = 'x'.repeat(1_100_000)
      await expectApiError(await rawApi(stack, 'notes', {
        method: 'POST',
        body: JSON.stringify({ body: oversized }),
      }), {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        label: 'oversized note',
      })
    } finally {
      await stack.teardown()
    }
  })
})
```

- [ ] **Step 2: Add rate-limit test**

Only add this if `createApi` exposes a low test limit option in this repo. If not, document the limitation in the report and skip implementation.

Expected shape:

```ts
import { describe, expect, it } from 'vitest'
import { createApi } from '@orbit-ai/api/node'
import { buildStack } from '../harness/build-stack.js'

describe('Security — rate limit', () => {
  it('returns RATE_LIMITED after the configured low test limit', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      const api = createApi({
        adapter: stack.adapter,
        version: '2026-04-01',
        rateLimit: { max: 2, windowMs: 60_000 },
      })
      const headers = {
        Authorization: `Bearer ${stack.rawApiKey}`,
        'Orbit-Version': '2026-04-01',
      }
      expect((await api.fetch(new Request('http://test.local/v1/contacts', { headers }))).status).toBe(200)
      expect((await api.fetch(new Request('http://test.local/v1/contacts', { headers }))).status).toBe(200)
      const limited = await api.fetch(new Request('http://test.local/v1/contacts', { headers }))
      expect(limited.status).toBe(429)
      const envelope = await limited.json() as { error?: { code?: string } }
      expect(envelope.error?.code).toBe('RATE_LIMITED')
    } finally {
      await stack.teardown()
    }
  })
})
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm -F @orbit-ai/e2e test -- src/security/payload-limit.test.ts src/security/rate-limit.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS, or payload-limit passes and rate-limit is documented as deferred if the API does not expose test configuration.

- [ ] **Step 4: Commit**

```bash
git add e2e/src/security/payload-limit.test.ts e2e/src/security/rate-limit.test.ts docs/reports/2026-05-26-business-e2e-coverage-closure-report.md
git commit -m "test: add payload and rate limit smokes"
```

---

## Task 8: Webhook SSRF Coverage

**Files:**
- Create: `e2e/src/security/webhook-ssrf.test.ts`

- [ ] **Step 1: Write webhook SSRF test**

Create:

```ts
import { describe, expect, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError, rawApi } from './helpers.js'

const BLOCKED_URLS = [
  'http://localhost:8080/hook',
  'http://127.0.0.1/hook',
  'http://169.254.169.254/latest/meta-data',
  'http://10.0.0.1/hook',
  'http://192.168.1.10/hook',
]

describe('Security — webhook SSRF', () => {
  it('rejects private and metadata webhook destinations', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      for (const url of BLOCKED_URLS) {
        await expectApiError(await rawApi(stack, 'webhooks', {
          method: 'POST',
          body: JSON.stringify({
            url,
            event_types: ['contact.created'],
          }),
        }), {
          status: 422,
          code: 'VALIDATION_FAILED',
          label: `blocked webhook ${url}`,
        })
      }
    } finally {
      await stack.teardown()
    }
  })
})
```

If the API returns a different error code for SSRF guard failures, assert the actual current structured code and update `docs/testing/security-e2e-matrix.md`.

- [ ] **Step 2: Run focused test**

Run:

```bash
pnpm -F @orbit-ai/e2e test -- src/security/webhook-ssrf.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/src/security/webhook-ssrf.test.ts
git commit -m "test: add webhook ssrf smoke"
```

---

## Task 9: MCP Stdio Wire Smoke

**Files:**
- Create: `e2e/src/security/mcp-stdio-smoke.test.ts`

- [ ] **Step 1: Inspect MCP package entry**

Run:

```bash
rg "stdio|createMcpServer|process.stdin|bin" packages/mcp packages/cli -n
cat packages/mcp/package.json
```

Expected: identify executable entrypoint or document that only in-process harness exists.

- [ ] **Step 2: Add stdio smoke if entrypoint exists**

Create a test that starts the MCP stdio server subprocess with `ORBIT_API_KEY` and uses the official MCP client stdio transport to call `tools/list` and `get_schema`.

If no executable stdio entrypoint exists, do not fake coverage. Add a report section:

```md
MCP stdio wire remains deferred because the current package exposes in-process test harness coverage but no stable CLI entrypoint for stdio E2E invocation.
```

- [ ] **Step 3: Run focused test**

Run:

```bash
pnpm -F @orbit-ai/e2e test -- src/security/mcp-stdio-smoke.test.ts
pnpm -F @orbit-ai/e2e typecheck
```

Expected: PASS, or documented deferral with exact repository evidence.

- [ ] **Step 4: Commit**

```bash
git add e2e/src/security/mcp-stdio-smoke.test.ts docs/reports/2026-05-26-business-e2e-coverage-closure-report.md
git commit -m "test: add mcp stdio smoke"
```

---

## Task 10: Documentation And Final Report

**Files:**
- Create: `docs/reports/2026-05-26-business-e2e-coverage-closure-report.md`
- Modify: `.gitignore`
- Modify: `packages/demo-seed/README.md`
- Modify: `e2e/README.md`
- Modify: `docs/product/business-e2e-scenario-map.md`
- Modify: `docs/testing/security-e2e-matrix.md`
- Modify: `docs/reports/2026-05-26-business-e2e-review-report.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Track report path**

Modify `.gitignore`:

```gitignore
!docs/reports/2026-05-26-business-e2e-coverage-closure-report.md
```

- [ ] **Step 2: Create report**

Create `docs/reports/2026-05-26-business-e2e-coverage-closure-report.md`:

```md
# Business E2E Coverage Closure Report

**Date:** 2026-05-26
**Database:** SQLite only by default
**Scope:** Integration event simulation plus expanded security coverage

## Summary

Describe the implemented fake integration events, idempotent replay checks, CLI graph isolation, auth/scope boundaries, redaction, payload/rate limits, webhook SSRF, and MCP stdio status.

## Files Changed

List every changed file.

## Tests Run

Record exact commands and results.

## Issues Found

Record any bugs or unsupported surfaces found.

## Bugs Fixed During Implementation

Record fixes made to code/harness/docs.

## Remaining Gaps

Only list real remaining gaps. Do not list a closed gap as deferred.

## Confidence

Set confidence after final verification. Target is 0.93+ if all tasks pass except Postgres/RLS.

## Recommended Next Slice

Recommend UI/agent prototype only if deterministic scenario and security coverage is now sufficient.
```

- [ ] **Step 3: Update docs**

Update:

- `packages/demo-seed/README.md`: document integration event scenario exports.
- `e2e/README.md`: add commands for new business/security tests.
- `docs/product/business-e2e-scenario-map.md`: mark integration event simulation implemented if Task 3 passed.
- `docs/testing/security-e2e-matrix.md`: mark each closed control with exact file evidence and keep remaining deferred controls precise.
- `CHANGELOG.md`: add bullets under business demo gate.

- [ ] **Step 4: Run docs hygiene**

Run:

```bash
rg "deferred|remain|MCP stdio|Postgres/RLS|redaction|idempotency|payload|rate|SSRF" docs/testing/security-e2e-matrix.md docs/reports/2026-05-26-business-e2e-review-report.md docs/reports/2026-05-26-business-e2e-coverage-closure-report.md e2e/README.md
```

Expected: deferred items are accurate and not stale.

- [ ] **Step 5: Commit docs**

```bash
git add .gitignore packages/demo-seed/README.md e2e/README.md docs/product/business-e2e-scenario-map.md docs/testing/security-e2e-matrix.md docs/reports/2026-05-26-business-e2e-review-report.md docs/reports/2026-05-26-business-e2e-coverage-closure-report.md CHANGELOG.md
git commit -m "docs: report business e2e coverage closure"
```

---

## Task 11: Final Verification And Reviews

**Files:**
- No new files unless review findings require fixes.

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm -r build
pnpm -F @orbit-ai/demo-seed test
pnpm -F @orbit-ai/e2e test
pnpm -F @orbit-ai/api test
pnpm -F @orbit-ai/sdk test
pnpm -F @orbit-ai/demo-seed typecheck
pnpm -F @orbit-ai/e2e typecheck
pnpm -F @orbit-ai/api typecheck
pnpm -F @orbit-ai/sdk typecheck
git diff --check
git status --short --branch
```

Expected:

- Build passes.
- Demo-seed tests pass.
- E2E tests pass with only existing intentional skips.
- API and SDK tests pass.
- Typechecks pass.
- `git diff --check` passes.
- Worktree is clean after final commits.

- [ ] **Step 2: Run code review**

Check:

```bash
git diff --stat f30a629..HEAD
rg "execute\\(|database\\.|db\\.|service_role|raw SQL|Promise\\.all|organizationId|organization_id|orgId|rawApiScopes|AUTH_INSUFFICIENT_SCOPE|externalId|secret|token" packages/demo-seed/src/scenarios e2e/src/business-journeys e2e/src/security e2e/src/harness -n
```

Expected:

- No raw SQL in scenario/test logic except existing Postgres key setup in `build-stack.ts`.
- No live provider calls.
- No secrets in test outputs.
- No parallel SQLite service reads in scenario answer helpers.

- [ ] **Step 3: Run security review**

Check:

- Tenant negative assertions use `RESOURCE_NOT_FOUND`, not existence-leaking `FORBIDDEN`.
- Scope assertions use `AUTH_INSUFFICIENT_SCOPE`.
- Redaction tests search both stdout and stderr.
- SSRF tests cover localhost, loopback, metadata, and private IPs.
- Idempotency tests prove replay returns the same record, not just same count.

- [ ] **Step 4: Run business logic review**

Check:

- Every scenario has positive control, negative control, and deterministic expected answer.
- Integration event simulation creates meaningful CRM state from fake provider payloads.
- The scenario map no longer claims implemented gaps are deferred.

- [ ] **Step 5: Run database review**

Check:

- SQLite remains default.
- No schema/migration changes unless explicitly justified.
- All writes go through core services.
- Helpers paginate when reading scenario data.
- Postgres/RLS remains clearly deferred unless explicitly implemented.

- [ ] **Step 6: Final commit for review fixes if needed**

If review fixes change files:

```bash
git add <changed-files>
git commit -m "fix: address coverage closure review findings"
```

---

## Acceptance Criteria

- Fake integration event scenario exists and is tested at package and E2E levels.
- Idempotent replay is proven for Gmail, Calendar, and Stripe fake events.
- CLI graph isolation covers the Account 360 graph beyond contacts/deals.
- Auth boundary covers missing/invalid key behavior.
- Scope boundary covers read-only key read success plus write/wrong-entity failures.
- Redaction smoke proves configured credential sentinels do not leak through user-visible outputs.
- Payload limit and webhook SSRF smokes pass.
- Rate-limit smoke passes or is explicitly deferred with exact repository evidence.
- MCP stdio smoke passes or is explicitly deferred with exact repository evidence.
- Full verification passes.
- Review report confidence is updated and backed by evidence.

