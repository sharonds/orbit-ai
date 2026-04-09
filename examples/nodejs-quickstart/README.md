# Orbit AI — Node.js Quickstart

A runnable end-to-end example that also serves as a CI smoke test.

## What it does

1. Creates an in-memory SQLite adapter and initialises the full Orbit schema.
2. Mounts `@orbit-ai/api` (Hono) against that adapter — no network required.
3. Intercepts `globalThis.fetch` so `@orbit-ai/sdk` routes HTTP calls directly into the Hono app.
4. Exercises the full CRUD lifecycle on contacts via **HTTP transport**:
   - list (empty) → create → list → get → update → error path → delete
5. Repeats the same flow via **DirectTransport** (in-process, zero network overhead).
6. Exits `0` on success, non-zero on any assertion failure.

## Run it

```bash
# from the monorepo root
pnpm install
pnpm -r build

# then run the quickstart
cd examples/nodejs-quickstart
pnpm start
```

Expected output:

```
=== Orbit AI Node.js quickstart ===

[setup] adapter + schema + services ready
[setup] @orbit-ai/api mounted
[setup] @orbit-ai/sdk HTTP transport ready

=== HTTP transport CRUD ===
[http] initial list: 0 contacts ✓
[http] created contact: contact_... ✓
[http] list after create: 1 contact ✓
[http] get by id ✓
[http] update ✓
[http] error path: RESOURCE_NOT_FOUND / 404 ✓
[http] delete ✓

=== DirectTransport CRUD ===
[direct] created contact: contact_... ✓
[direct] list ✓

=== All smoke tests passed ===
```

## What it demonstrates

| Concept | Where |
|---------|-------|
| In-memory SQLite adapter | `createSqliteOrbitDatabase()` + `initializeAllSqliteSchemas()` |
| API key auth (hashed) | `lookupApiKeyForAuth` callback + SHA-256 pre-hash |
| HTTP transport | `OrbitClient({ apiKey, baseUrl })` |
| DirectTransport | `OrbitClient({ adapter, context })` |
| Error handling | `OrbitApiError` with `.code` + `.status` |
