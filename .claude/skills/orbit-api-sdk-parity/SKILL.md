---
name: orbit-api-sdk-parity
description: Reviews API and SDK code for transport parity, envelope consistency, and secret-redaction alignment. Invoke this skill at Wave Gate 2 and Wave Gate 3 during API+SDK execution, or whenever a change touches packages/api/src/routes/, packages/sdk/src/transport/, packages/sdk/src/resources/, or any file that shapes envelopes, error codes, pagination metadata, or sanitized read DTOs across the HTTP and direct transports. Also use when reviewing PRs that add or modify SDK resource methods, API route registrations, or the direct transport dispatch map.
---

# Orbit API/SDK Parity Review

This skill reviews code for parity between the API and SDK packages. The SDK must behave identically whether it talks to the API over HTTP or directly to core services. Envelope drift, missing sanitization, or error-code mismatches between transports are the primary failure modes.

## When to skip this skill

- Changes entirely within `@orbit-ai/core` that don't touch service return shapes
- Documentation-only changes
- CLI or MCP changes that don't modify the SDK transport or API route layer
- Test-only changes that don't alter production code behavior

## Step 1: Load context

Read these files to ground your review:

1. `docs/specs/02-api.md` — sections 3 (API Conventions: envelope, errors, pagination, includes), 5 (Endpoint Matrix), 7 (Request and Response Shapes), and 7.2 (Sensitive Read Contracts)
2. `docs/specs/03-sdk.md` — sections 4 (Transport Contract), 5 (Resource Base Class), 6 (Typed Resource Interfaces), 7 (Auto-Pagination), and 10 (Direct Mode Semantics)
3. `docs/superpowers/specs/2026-04-03-api-sdk-execution-design.md` — section 3 (Lessons From Core Execution) for the failure modes this review prevents

Read relevant sections based on what the changed code touches.

## Step 2: Identify what changed

Classify each changed file:

- **API route layer**: routes, middleware, envelope helpers, sanitization functions in `packages/api/src/`
- **SDK transport layer**: HTTP transport, direct transport, dispatch map in `packages/sdk/src/transport/`
- **SDK resource layer**: resource classes, pagination, search in `packages/sdk/src/resources/` and `packages/sdk/src/`
- **Shared contract surface**: error types, envelope types, pagination types in `@orbit-ai/core`

## Step 3: Review against parity rules

### Rule 1: Resource methods map 1:1 to API routes

Every public API route must have a corresponding SDK resource method. Every SDK resource method must call a route that actually exists in the API. Check:

- `PUBLIC_ENTITY_CAPABILITIES` in `packages/api/src/routes/entities.ts` lists an entity ↔ a resource class exists in `packages/sdk/src/resources/`
- Workflow endpoints (deal move, sequence enroll/unenroll, tag attach/detach) have matching SDK methods on the correct resource class
- Admin routes under `/v1/admin/*` are not exposed through public SDK resources
- Schema routes (`/v1/objects*`, `/v1/schema/migrations/*`) map to `SchemaResource` methods

If a route exists in the API but has no SDK method (or vice versa), that's a parity gap.

### Rule 2: Identical envelope shapes across transports

HTTP mode returns server-generated envelopes. Direct mode must synthesize structurally identical envelopes. Check:

- `meta.request_id` — present in both transports, unique per request (not `Date.now()`)
- `meta.version` — matches in both transports
- `meta.cursor`, `meta.next_cursor`, `meta.has_more` — identical pagination semantics
- `links.self` — matches the canonical API path
- `data` — same record shape (including field names, snake_case consistency)

If the direct transport fabricates envelope fields differently from the API, that's a high-severity finding.

### Rule 3: Identical error codes across transports

Both transports must surface the same `OrbitApiError` error codes for the same failure conditions:

- `RESOURCE_NOT_FOUND` when an entity doesn't exist
- `VALIDATION_FAILED` for bad input
- `AUTH_INSUFFICIENT_SCOPE` for scope violations
- `CONFLICT` and `IDEMPOTENCY_CONFLICT` for write conflicts

If the HTTP transport returns `VALIDATION_FAILED` but the direct transport throws an untyped `Error` for the same condition, that's a high-severity finding.

### Rule 4: Secret-bearing reads are sanitized in both transports

The API route layer applies `sanitizePublicRead()` and `sanitizeAdminRead()` before returning responses. The direct transport must apply equivalent sanitization. Check:

- Webhook reads: `secretEncrypted` is stripped in both transports
- Webhook delivery reads: `payload`, `signature`, `idempotencyKey`, `responseBody` are stripped in both
- API key admin reads: `keyHash` is stripped in both
- Audit log admin reads: `before`/`after` snapshots have sensitive fields redacted in both
- Idempotency key admin reads: `requestHash`, `responseBody` are stripped in both

If the HTTP transport sanitizes but the direct transport returns raw records, that's a critical finding — it repeats the `keyHash` leak from core Wave 1.

### Rule 5: `.response()` and `.firstPage()` preserve server-owned metadata

These are the public escape hatches for raw envelopes. Check:

- `.response()` calls `rawRequest()` (not `request()`) and returns the full `OrbitEnvelope<T>` unchanged
- `list().firstPage()` returns the full envelope including `meta.next_cursor` and `meta.has_more`
- `list().autoPaginate()` yields records (not envelopes) and handles cursor chaining
- No SDK helper reconstructs or fabricates `meta`, `links`, or `request_id` client-side

### Rule 6: Batch, workflow, and schema helpers preserve canonical paths

Non-CRUD methods must call the same canonical API paths in both transports:

- `deals.move(id, input)` → `POST /v1/deals/:id/move`
- `sequences.enroll(id, input)` → `POST /v1/sequences/:id/enroll`
- `sequenceEnrollments.unenroll(id)` → `POST /v1/sequence_enrollments/:id/unenroll`
- `tags.attach(id, body)` → `POST /v1/tags/:id/attach`
- `schema.addField(type, input)` → `POST /v1/objects/:type/fields`
- `search.query(input)` → `POST /v1/search`
- `contacts.context(idOrEmail)` → `GET /v1/context/:contactId`

If the direct transport dispatches these to different core service methods than the API route would use, that's a parity gap.

## Step 4: Produce the review note

Write a concise review note with these sections:

### Transport coverage
Which transports were tested? (HTTP only, direct only, or both)

### Route/resource alignment
Are all API routes covered by SDK resources and vice versa? List any gaps.

### Envelope parity
Do HTTP and direct mode produce identical envelope shapes? List any divergences.

### Error code parity
Do both transports surface the same error codes? List any divergences.

### Secret redaction parity
Are secret-bearing reads sanitized identically in both transports? List any gaps.

### Response helper correctness
Do `.response()`, `.firstPage()`, and `.autoPaginate()` behave correctly? List any issues.

### Findings (if any)

```
- [CRITICAL] <description> — <file>:<line>
- [HIGH] <description> — <file>:<line>
- [MEDIUM] <description> — <file>:<line>
```

Severity definitions:
- **CRITICAL**: Secret-bearing data exposed in one transport but sanitized in the other. SDK fabricates server-owned metadata client-side.
- **HIGH**: Envelope shape divergence between transports. Error code mismatch. Missing SDK resource method for an existing API route. Direct transport dispatch calls wrong core service method.
- **MEDIUM**: Pagination metadata inconsistency. Missing `.response()` method on a resource. Workflow helper calls non-canonical path.

### Validation

Explicitly state pass or fail for each check:

1. **Resource ↔ route 1:1 mapping**: Pass/Fail — [brief evidence]
2. **Envelope shape parity**: Pass/Fail — [brief evidence]
3. **Error code parity**: Pass/Fail — [brief evidence]
4. **Secret redaction parity**: Pass/Fail — [brief evidence]
5. **Response helper correctness**: Pass/Fail — [brief evidence]
6. **Workflow/schema path parity**: Pass/Fail — [brief evidence]

If any check fails, the review outcome is **FAIL** and the findings must be resolved before the wave gate can pass.
