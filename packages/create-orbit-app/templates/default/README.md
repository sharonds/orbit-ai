# __APP_NAME__

Scaffolded with [@orbit-ai/create-orbit-app](https://www.npmjs.com/package/@orbit-ai/create-orbit-app).

## Run

```bash
npm start
# or: pnpm start / yarn start / bun start
```

This boots an in-memory SQLite adapter, seeds the Acme Events demo tenant (200 contacts, 40 companies, 15 deals), and runs a handful of SDK queries against it.

## What's inside

- `src/index.ts` — entry point with a working demo flow
- `@orbit-ai/core` — storage + entities
- `@orbit-ai/sdk` — typed client, used in direct-mode here
- `@orbit-ai/demo-seed` — realistic multi-tenant fixture

## Next

- Point at your own Postgres: set `DATABASE_URL` and swap `createSqliteOrbitDatabase` for the Postgres adapter in `src/index.ts`.
- Prefer another package manager? Use the equivalent `pnpm start`, `yarn start`, or `bun start` command.
- Read the [Orbit docs](https://orbit-ai.dev) (coming soon).
