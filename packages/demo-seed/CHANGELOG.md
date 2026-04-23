# Changelog

All notable changes to `@orbit-ai/demo-seed` are documented here.

## [Unreleased]

- Initial release. Deterministic multi-tenant seed dataset (`acme` and `beta` profiles) built on top of `@orbit-ai/core` services.
- Safety: `seed({ mode: 'reset' })` now refuses to wipe an organization the current call did not create unless `allowResetOfExistingOrg: true` is set explicitly. Guards against a slug collision with a real tenant named "Acme Events" / "Beta Collective".
- Safety: `resetSeed()` clears `entity_tags` before `tags` to prevent FK violations when a consumer has associated seed tags with records.
- Fix: `seedPipelinesAndStages` is now append-idempotent — re-uses any existing "Default Sales Pipeline" and its stages rather than creating duplicates.
- Fix: `seedTags` filters by name directly instead of paginating the first 100 tags, which silently broke for tenants with more than 100 tags.
- Fix: `seedUsers` strips spaces/punctuation from generated emails so names like "De Boer" pass Zod validation.
- Fix: `pnpm pack` now includes the compiled `dist/` via a `prepack` script. Previously tarballs contained only metadata.
- Packaging: demo domains use only IANA-reserved, non-routable TLDs per RFC 2606 / 6761 (`.test`, `.example`, `.invalid`); demo user emails keep the RFC 6762 `.local` suffix.
- Packaging: `engines.node` pinned to `>=22.0.0`.
