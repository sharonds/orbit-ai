# Contributing to Orbit AI

Reference guide for extending the monorepo — adding entities, adapters, and understanding the entity list.

> **Before implementing:** read the Key Architecture Rules and Coding Conventions in [CLAUDE.md](../CLAUDE.md). Every entity must include `organization_id` + RLS policy, use Drizzle ORM syntax (no raw SQL), and follow the migration transaction-wrapping pattern.

## Adding an Entity

1. Drizzle schema in `packages/core/src/schema/<entity>.ts`
2. Types in `packages/core/src/types.ts`
3. Repository in `packages/core/src/entities/<entity>/repository.ts`
4. Service in `packages/core/src/entities/<entity>/service.ts`
5. Wire into `packages/core/src/services/index.ts` (createCoreServices)
6. REST routes in `packages/api/src/routes/<entity>.ts`
7. Register in `packages/api/src/create-api.ts`
8. Resource in `packages/sdk/src/resources/<entity>.ts`
9. Wire into `packages/sdk/src/client.ts`
10. Export types (NOT class) from `packages/sdk/src/index.ts`

## Adding a Storage Adapter

1. Create `packages/core/src/adapters/<name>/adapter.ts`
2. Implement `StorageAdapter` interface from `packages/core/src/adapters/interface.ts`
3. Create database + schema setup files
4. Export from `packages/core/src/index.ts`

## Entity Reference

### Base Entities

contacts, companies, deals, pipeline_stages, activities, products, payments, contracts, channels, sequences, tags, notes

### System Entities

users, webhooks, imports, schema-migrations, idempotency-keys, api-keys, organizations, organization-memberships, audit-logs, custom-field-definitions, webhook-deliveries
