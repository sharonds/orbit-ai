# @orbit-ai/demo-seed

Deterministic, multi-tenant realistic demo dataset for Orbit AI. Designed to power E2E tests, the `create-orbit-app` starter, and landing-page demo content (none of those consumers are wired to this package yet — this is the alpha of the seeder itself).

> **All names, domains, and emails in this package are synthetic. No real customer data is included.** Company domains use only IANA-reserved, non-routable TLDs per RFC 2606 and RFC 6761 (`.test`, `.example`, `.invalid`); demo user emails use the RFC 6762 `.local` suffix. Nothing seeded here resolves to a real domain.

## Status

Alpha (`0.1.0-alpha`). Install from npm after the release is cut, or depend on it via the monorepo `workspace:*` protocol while developing locally.

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

// Standalone reset (leaves the organization record intact).
// DANGER: this wipes ALL rows in the listed entity types for that org —
// not just rows the seeder created. See "Safety" below.
import { resetSeed } from '@orbit-ai/demo-seed'
await resetSeed(adapter, organizationId, { confirmWipeAllTenantData: true })
```

`resetSeed()` walks every entity the seeder writes in FK-reverse order — activities → notes → tasks → deals → contacts → stages → pipelines → companies → entity_tags → tags → users — and deletes every row in those tables for the given `organizationId`. Seeded records carry no marker, so a "reset" cannot distinguish demo rows from rows a consumer added on top: the call is a tenant-wide wipe of those entity types. `entity_tags` is cleared before `tags` to avoid FK violations from consumer-created tag associations. If a core service is ever missing `list`/`delete`, it fails loudly rather than leaving a half-reset tenant behind.

## Safety

**`resetSeed` is a tenant-wide data wipe, not a demo-row scrub.** There is no marker on seeded records, so `resetSeed` deletes *every* row in activities, notes, tasks, deals, contacts, stages, pipelines, companies, entity_tags, tags, and users for the given organization — including anything a consumer added after seeding. Pointing it at a production `organizationId` will wipe that tenant. To make the destructive contract impossible to miss, the call requires an explicit acknowledgement flag:

```ts
import { resetSeed } from '@orbit-ai/demo-seed'

await resetSeed(adapter, organizationId, {
  confirmWipeAllTenantData: true, // required; omitting throws before any delete
})
```

`mode: 'reset'` on `seed()` is the same kind of destructive. The seeder matches organizations by fixed profile slug (`acme-events`, `beta-collective`), and if your target database happens to already contain an organization with that slug — say a real customer named "Acme Events" — a naïve reset would wipe their data.

To guard against that, `seed()` throws when `mode: 'reset'` would operate on an organization that the current call did **not** just create. Set `allowResetOfExistingOrg: true` only when you know the matching organization is a seed-created demo tenant and losing its data is intentional:

```ts
await seed(adapter, {
  profile: TENANT_PROFILES.beta,
  mode: 'reset',
  allowResetOfExistingOrg: true, // explicit opt-in required
})
```

## Determinism

All randomness is driven by a seeded PRNG keyed off `profile.randomSeed` (override via `opts.randomSeed`). Seeding the same profile against a fresh database produces identical content **under a stable projection** — same company names, same contact emails, same deal titles, same note bodies.

Ordering caveat: IDs are ULIDs with per-call randomness, so records that share a `created_at` millisecond can surface in either ULID tiebreak order between runs. The determinism test in `seed.test.ts` normalizes that by sorting the projected rows client-side. If you rely on determinism, sort by a stable business field (email, name, content) rather than by insertion order.

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
| `resetSeed(adapter, orgId, { confirmWipeAllTenantData: true })` | **Destructive.** Wipes every row in the seeded entity types for that organization — not just demo rows. Requires explicit acknowledgement flag. See "Safety". |
| `TENANT_PROFILES` | `{ acme, beta }` — tuned scale presets. |
| `createPrng(seed)` | Internal PRNG factory (exported for advanced custom seeders). |
| Types: `SeedOptions`, `SeedResult`, `SeedMode`, `ResetSeedOptions`, `TenantProfile`, `ProfileCounts`, `Prng` | |
