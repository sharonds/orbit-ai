# @orbit-ai/demo-seed

Deterministic, multi-tenant realistic demo dataset for Orbit AI. Powers E2E tests, the `create-orbit-app` starter, and landing-page demo content.

> **All names, domains, and emails in this package are synthetic. No real customer data is included.**

## Status

Alpha — not yet published to npm. Consumers inside this monorepo depend on it via the `workspace:*` protocol.

## Install

```bash
pnpm add -D @orbit-ai/demo-seed @orbit-ai/core
```

Requires Node 22+ (for stable `node:sqlite`) and `@orbit-ai/core` as a peer/parallel dep — the seeder writes through core's storage adapters and service registry.

## Quick start

```ts
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'

const database = createSqliteOrbitDatabase()
const adapter = createSqliteStorageAdapter({ database })
await adapter.migrate()

const result = await seed(adapter, { profile: TENANT_PROFILES.acme })
console.log(result.organization.slug) // 'acme-events'
console.log(result.counts)             // { contacts: 200, companies: 40, ... }
```

## Tenant profiles

| Profile | Contacts | Companies | Deals | Activities | Notes | History |
|---------|---------:|----------:|------:|-----------:|------:|:--------|
| `acme`  | 200      | 40        | 15    | 300        | 50    | 30 days |
| `beta`  | 50       | 10        | 3     | 50         | 10    | 14 days |

Both profiles also create a default sales pipeline with 5 stages (Prospect → Qualified → Proposal → Closed-Won/Lost), 3 users, and a shared set of demo tags (`hot-lead`, `enterprise`, `eu`, `partner`, `champion`).

## Modes

`seed()` takes an optional `mode` to control what happens when the target organization already has data:

| Mode | Behavior |
|------|----------|
| `fail-if-exists` (default) | Throws. Forces callers to opt into destructive behavior. |
| `reset` | Calls `resetSeed()` first, then re-seeds deterministically. |
| `append` | Seeds on top of existing data. Non-deterministic; only for explicit "grow" scenarios. |

```ts
// Safe default — raises if the org already has demo data
await seed(adapter, { profile: TENANT_PROFILES.beta })

// Wipe + reseed
await seed(adapter, { profile: TENANT_PROFILES.beta, mode: 'reset' })

// Standalone reset (leaves the organization record intact)
import { resetSeed } from '@orbit-ai/demo-seed'
await resetSeed(adapter, organizationId)
```

`resetSeed()` deletes every entity the seeder writes in FK-reverse order: activities → notes → tasks → deals → contacts → stages → pipelines → companies → tags → users. If a core service is ever missing `list`/`delete`, it fails loudly rather than leaving a half-reset tenant behind.

## Determinism

All randomness is driven by a seeded PRNG keyed off `profile.randomSeed` (override via `opts.randomSeed`). Seeding the same profile against a fresh database produces identical record content every time — same company names, same contact emails, same deal titles, same note bodies, in the same order.

Time-dependent fields (activity `occurred_at`) are computed as offsets from `opts.now ?? Date.now()`. To get byte-identical activity timestamps across runs, pass a fixed `now`:

```ts
const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)
await seed(adapter, { profile: TENANT_PROFILES.beta, now: fixedNow })
```

Auto-generated IDs (ULIDs) and `created_at` values will naturally differ per run — determinism guarantees apply to **content and relative ordering**, not to primary keys.

## API

| Export | Description |
|--------|-------------|
| `seed(adapter, opts)` | Top-level orchestrator. Returns `{ organization, counts }`. |
| `resetSeed(adapter, orgId)` | Deletes all seeded records for one organization. |
| `TENANT_PROFILES` | `{ acme, beta }` — tuned scale presets. |
| `createPrng(seed)` | Internal PRNG factory (exported for advanced custom seeders). |
| Types: `SeedOptions`, `SeedResult`, `SeedMode`, `TenantProfile`, `ProfileCounts`, `Prng` | |
