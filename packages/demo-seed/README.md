# @orbit-ai/demo-seed

Deterministic, multi-tenant realistic demo dataset for Orbit AI. Powers E2E tests, the `create-orbit-app` starter, and landing-page demo content.

> **All names, domains, and emails in this package are synthetic. No real customer data is included.**

## Tenant profiles

| Profile | Contacts | Companies | Deals | Activities | Notes | History |
|---------|---------:|----------:|------:|-----------:|------:|:--------|
| `acme`  | 200      | 40        | 15    | 300        | 50    | 30 days |
| `beta`  | 50       | 10        | 3     | 50         | 10    | 14 days |

## Status

Alpha — not yet published to npm.

## Determinism

All randomness is driven by a seeded PRNG (`seedrandom`) keyed off the tenant profile, so seeding the same profile against a fresh database produces identical records every time.
