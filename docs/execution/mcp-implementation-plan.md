# Orbit AI MCP Implementation Plan

Date: 2026-04-09
Revised: 2026-04-09 (post multi-agent review: architecture, security, testing)
Status: Execution-ready baseline
Package: `@orbit-ai/mcp`
Depends on:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md)
- [sdk-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/sdk-implementation-plan.md)
- [cli-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/cli-implementation-plan.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/mcp` as the next agent-facing package track after the API and SDK baselines.

The MCP package is not a second transport contract. It is an agent-native server over the accepted SDK and API behavior. Its job is to expose the fixed 23-tool core registry, MCP resources, and tool-specific safety guidance without re-deciding routes, envelopes, secret-redaction rules, or workflow semantics in a separate layer.

This document is intentionally precise because it will be executed by AI sub-agents without human clarification. Every discrepancy between the spec and the real codebase is documented here. Agents must follow this plan rather than `docs/specs/05-mcp.md` where they conflict.

## 2. Spec Corrections

The following errors appear in `docs/specs/05-mcp.md`. Agents must use the corrected forms below.

### 2.1 `crm.*` Namespace Does Not Exist

The spec's tool-to-core mapping (Section 12), Section 7.1 (`move_deal_stage`), and Section 10 (resources) all reference a `crm` namespace on `OrbitClient`. **This namespace does not exist.** The client exposes resources directly.

Correct all spec references as follows:

| Spec (WRONG) | Correct call |
|---|---|
| `crm.deals.move()` | `client.deals.move(id, { stage_id })` — see Section 2.5 for `occurred_at`/`note` caveat |
| `crm.deals.stats()` | `client.deals.stats(query?)` |
| `crm.pipelines.list()` | `client.pipelines.list(query?)` |
| `crm.activities.create()` | `client.activities.log(body)` — the `log` route, NOT `create` |
| `crm.activities.list()` | `client.activities.list(query?)` |
| `crm.schema.listObjects()` | `client.schema.listObjects()` |
| `crm.schema.addField()` | `client.schema.addField(type, body)` |
| `crm.schema.updateField()` | `client.schema.updateField(type, fieldName, body)` |

Every sub-agent implementing a tool handler must use the flat `client.<resource>.<method>()` form.

### 2.2 Sequence Tool Call Signatures

The spec maps both sequence tools to "sequence enrollment API" without method names. The correct calls are:

- `enroll_in_sequence` → `client.sequences.enroll(sequenceId, { contact_id, ...body })` — on `SequenceResource` (`sequences.ts` line 32)
- `unenroll_from_sequence` → `client.sequenceEnrollments.unenroll(enrollmentId)` — on `SequenceEnrollmentResource` (`sequence-enrollments.ts` line 33)

These are on two different resources. Do NOT use `client.sequenceEnrollments.create()` or `client.sequenceEnrollments.delete()`.

### 2.3 `sensitive.ts` Import Path

The spec's `output/sensitive.ts` imports from `@orbit-ai/api/contracts/sensitive`. This path does not exist. The correct import is:

```typescript
import type { WebhookRead } from '@orbit-ai/api'
```

### 2.4 `log_activity` Uses `activities.log()`, Not `activities.create()`

`ActivityResource` exposes `client.activities.log(body)` which POSTs to `/v1/activities/log`. The spec maps `log_activity` to "`crm.activities.create()` or `/v1/activities/log`." The correct call is `client.activities.log(body)` — not `create()`, which POSTs to `/v1/activities` (standard CRUD). Using `create()` instead of `log()` hits the wrong endpoint.

### 2.5 `deals.move()` Current SDK Signature Is `{ stage_id: string }` Only

The current `DealResource.move(id, input)` accepts `input: { stage_id: string }` — no `occurred_at` or `note` fields. The spec's `move_deal_stage` tool input schema includes those fields. Until `DealResource.move()` is extended in `@orbit-ai/sdk` to accept them, the MCP handler must:

1. Accept `occurred_at?` and `note?` in the tool input schema (so agents can provide them).
2. Strip those fields before calling `client.deals.move(id, { stage_id })` — passing them would fail TypeScript strict mode.
3. Add a code comment noting this information loss and that the SDK must be extended.

The SDK extension (`move(id: string, input: MoveDealStageInput)` where `MoveDealStageInput` includes `occurred_at?: string` and `note?: string`) should be the prerequisite task before Slice D. If it is added to the SDK, remove the stripping logic.

### 2.6 `unenroll_from_sequence` — `reason` And `idempotency_key` Not Forwarded To SDK

`SequenceEnrollmentResource.unenroll(id: string)` takes only one argument. The spec's `unenroll_from_sequence` tool schema includes `reason?` and `idempotency_key?`. The MCP handler must accept these fields in the tool input (for forward compatibility) but document in a code comment that the current SDK signature does not support forwarding them. Do not fabricate an idempotency key locally — the SDK call is already idempotent by nature (repeated unenroll of the same ID should no-op). Omit `reason` and `idempotency_key` from the `client.sequenceEnrollments.unenroll()` call entirely.

### 2.7 `resources/schema.ts` Missing From Directory Manifest

The spec's Section 2 directory listing omits `resources/schema.ts`. This file must exist alongside `resources/team-members.ts`. The plan's file-to-slice table (Section 8) is authoritative.

## 3. Current Readiness And Constraints

Current repository state:

- `packages/mcp` does not exist yet
- `packages/api` and `packages/sdk` exist and already provide most of the parity surface MCP should consume

### 3.1 Confirmed SDK Surface For Tool Handlers

Verify every call in the actual source file before implementing. Flat client namespace:

```
client.contacts     client.companies     client.deals
client.stages       client.activities    client.tasks
client.notes        client.products      client.payments
client.contracts    client.sequences     client.sequenceSteps
client.sequenceEnrollments              client.sequenceEvents
client.pipelines    client.tags          client.schema
client.webhooks     client.imports       client.users
client.search
```

**`relate_records` SDK backing** — depends on `relationship_type`:
- `relationship_type: 'tag'` → `client.tags.attach(tagId, { entity_type, entity_id })` or `client.tags.detach(tagId, { entity_type, entity_id })`
- `relationship_type: 'contact_company' | 'contact_deal' | 'company_deal'` → `client.<entity>.update(id, { contact_id | company_id })` — there is no dedicated link endpoint; this is a targeted field patch
- The plan must not imply dedicated relation endpoints exist in the SDK beyond the above

**`list_related_records` SDK backing** — there is no SDK resource method for relationship sub-routes (e.g., no `client.contacts.deals()`). These routes exist on the API (`GET /v1/contacts/:id/deals` etc.) but the SDK does not expose them as named methods. `OrbitClient.transport` is `private readonly` — `transport.rawRequest()` is unreachable from the MCP package. **`list_related_records` must be registered as a `McpNotImplementedError` stub (code: `DEPENDENCY_NOT_AVAILABLE`) until named relationship helpers (e.g., `client.contacts.listDeals(id)`) are added to `@orbit-ai/sdk`.** The stub must be added to the gated tools table in Section 3.2. Do not attempt to access the private transport field.

**`bulk_operation` SDK backing** — maps to `client.<entity>.batch(body)` via `BaseResource.batch()`. Entities that support batch: contacts, companies, deals, activities, tasks, notes, products, payments, contracts, sequences, tags. Entities that do NOT support batch: pipelines, stages, users, sequence_steps, sequence_enrollments, sequence_events. For unsupported entities, return a `McpNotImplementedError` immediately without calling the SDK.

### 3.2 Gated Tools

Five tools have no complete SDK/API seam today and must be registered in the 23-tool array as `McpNotImplementedError` stubs. They must appear in `buildTools()` at all times to preserve the 23-count invariant. They must never be omitted conditionally.

| Tool | Missing seam | Required stub behavior |
|------|-------------|------------------------|
| `import_records` | SDK type mismatch: `ImportResource.create()` types `{ entity_type, status?, total_rows? }` — no `file` or `file_path` field. Some SDK tests reference `imports.create({ file, entity })` against a drifted shape. Until the import seam is unified in `@orbit-ai/sdk` (adding a real file-upload path), this must remain a stub. | Return `McpNotImplementedError` with `code: 'DEPENDENCY_NOT_AVAILABLE'` |
| `list_related_records` | `OrbitClient.transport` is `private` — `rawRequest()` is unreachable from the MCP package. No named relationship helpers exist on the SDK (e.g., no `client.contacts.listDeals()`). Must stay stubbed until `@orbit-ai/sdk` adds named relationship methods. | Return `McpNotImplementedError` with `code: 'DEPENDENCY_NOT_AVAILABLE'` |
| `export_records` | No export resource or route in SDK | Return `McpNotImplementedError` with `code: 'DEPENDENCY_NOT_AVAILABLE'` |
| `run_report` | No reporting API surface in SDK | Return `McpNotImplementedError` with `code: 'DEPENDENCY_NOT_AVAILABLE'` |
| `get_dashboard_summary` | No dashboard summary API in SDK | Return `McpNotImplementedError` with `code: 'DEPENDENCY_NOT_AVAILABLE'` |

The `recovery` field in the stub error must say: `"This capability is not yet available. Check the Orbit changelog for availability."`

## 4. In Scope

Package bootstrap:

- `packages/mcp/package.json`
- `packages/mcp/tsconfig.json`
- `packages/mcp/vitest.config.ts`
- `packages/mcp/src/index.ts`
- `packages/mcp/src/server.ts`

Shared runtime:

- client/config handoff into the MCP server
- tool definition helpers and `defineTool()` wrapper
- tool registry and dispatch (`executeTool`)
- runtime Zod input validation in every handler
- structured error conversion (`toToolError`)
- output truncation and secret sanitization helpers

Transport work:

- stdio transport
- HTTP transport
- one shared tool runtime used by both transports

Tool work:

- all 23 core tools from the spec
- safety annotations on every tool
- LLM-oriented tool descriptions
- `McpNotImplementedError` stubs for gated tools (Section 3.2)

Resource work:

- `orbit://team-members` via `src/resources/team-members.ts`
- `orbit://schema` via `src/resources/schema.ts`

Contract proof:

- registry count tests (3 specific cases — see Slice B)
- annotation completeness tests (per-tool — see Slice B)
- `toToolError()` tests (3 specific cases — see Slice B)
- tool handler tests with SDK mock pattern (see Slices C and D)
- `confirm: true` enforcement tests (2 cases — see Slice C)
- secret redaction tests (3 specific scenarios — see Slices B and G)
- `object_type` dispatch coverage tests (see Slice C)
- `move_deal_stage` must-not-patch test (see Slice D)
- gated tool stub behavior tests (see Slice G)
- transport parity tests (see Slice F)
- final review artifacts under `docs/review/`

## 5. Out Of Scope

- integration extension tools in the core package
- a composite plugin runtime for connectors
- inventing MCP-only business logic that bypasses the SDK
- implementing the missing schema engine or reporting engine during the MCP branch
- broad hosted identity/runtime design beyond the frozen stdio and HTTP seams

If the MCP package needs a missing client capability, the default fix should be adding the seam in `@orbit-ai/sdk` first, not bypassing into raw core or ad hoc API calls from MCP.

## 6. Required Execution Principles

### 6.1 SDK And Tool Contract

1. The MCP package is a tool/runtime layer over the SDK. It may adapt inputs and outputs for tool use, but it may not own business logic.
2. The core package contract is fixed at exactly 23 tools. No more, no fewer. All 23 must appear in `buildTools()` unconditionally.
3. Tool definitions must be explicit TypeScript objects with `title`, `description`, `inputSchema`, `annotations.readOnlyHint`, `annotations.destructiveHint`, and `annotations.idempotentHint`.
4. Tool descriptions must tell the model when to use the tool and when not to use it.
5. Tool handlers must return structured machine-readable JSON in MCP content blocks, not prose-only blobs.
6. Tool errors must always include `code`, `message`, `hint`, and `recovery`.
7. Secret-bearing reads must remain sanitized, and long text must be truncated deterministically with explicit truncation markers.
8. Hosted/remote MCP should prefer the HTTP-backed client path; direct-mode MCP is valid only for trusted local embeddings and must stay explicit about that trust model.
9. Tools whose underlying SDK/API capability is not real yet must be registered as stubs that return `McpNotImplementedError` — never omitted from the registry, never simulated with fake data.

### 6.2 Security Principles

These are not optional. All must be implemented in the slice they are assigned to.

10. **Runtime Zod validation in every handler**: every tool handler MUST parse `args` with the same Zod schema used to generate `inputSchema` before executing any SDK call. A `ZodError` must return a structured tool error immediately. The JSON Schema metadata for the MCP client is NOT sufficient — both must exist and must agree. Implement in Slice B.

11. **`confirm: true` enforced in handler**: `delete_record`'s `confirm: true` requirement is enforced by the handler's Zod parse at runtime, not by the MCP client. The same applies to every delete operation inside `bulk_operation`. Implement in Slice C (delete_record) and Slice D (bulk_operation). A test must verify this (see Section 9, Slices C and D).

12. **`toToolError()` sanitizes error messages**: `toToolError()` must truncate `error.message` to 500 characters maximum and strip patterns matching `[A-Za-z0-9_-]{20,}` adjacent to `://` (connection strings), strings starting with `Bearer `, and the literal word `secret`. The sanitized message may replace sensitive content with `[redacted]`. The same sanitization applies to `hint` and `recovery` if propagated from an underlying provider error. Implement in Slice B.

13. **In-handler secret sanitization (defense-in-depth)**: tool handlers that read secret-bearing objects (webhooks, integration connections, sync states) must strip sensitive fields before serializing to a content block — even if the SDK's read model has already done so. This defends against DirectTransport mode where the SDK may return fuller objects. Implement in Slices C and G.

14. **Free-form string input truncation**: free-form string inputs (`query`, `body`, `note`, and top-level string values in `record` payloads) must be truncated to 10,000 characters at the tool handler layer before being passed to the SDK. Implement in Slice B as a shared input-sanitization helper.

15. **Direct mode startup warning**: when the MCP server starts with a `DirectTransport`-backed SDK client, it must emit a structured warning to stderr before accepting any requests. The warning must list the specific protections absent: API-layer authentication, per-org rate limiting, scope enforcement, SSRF webhook destination checks. Implement in Slice E.

16. **HTTP transport binding and auth**: the HTTP transport must bind to `127.0.0.1` by default. Binding to a wildcard interface requires an explicit `bindAddress` config option with a stderr warning. Auth uses the same hash-then-lookup pattern as the API middleware: SHA-256 hash the raw bearer token, then call `adapter.lookupApiKeyForAuth(hash)`. There is no separate token validation HTTP endpoint. `adapter` must be injected by the caller — the MCP package does not construct its own adapter. A missing, invalid, revoked, or expired token returns HTTP 401 before the MCP request is decoded. Implement in Slice F.

17. **SSRF in direct-mode webhook writes**: when operating in stdio direct mode, `create_record` and `update_record` for `object_type: 'webhooks'` must validate the `url` field against an SSRF block list before calling the SDK. Block list must include: RFC1918 ranges, link-local `169.254.0.0/16`, loopback `127.0.0.0/8` / `::1`, and `169.254.169.254`. Return a `McpValidationError` for blocked URLs. Implement in Slice C.

18. **Resource content prompt injection guard**: resource handlers for `orbit://team-members` and `orbit://schema` must wrap their output with an `_untrusted: true` frame and truncate individual string fields to 500 characters. Return format:

```json
{ "_type": "orbit_resource", "_untrusted": true, "data": [...] }
```

Implement in Slice E.

19. **`bulk_operation` pre-execution audit in direct mode**: in direct-mode stdio, `bulk_operation` with any delete operations must emit a pre-execution audit log entry to stderr (before the first delete reaches the SDK) recording: operation count, object type, and list of record IDs to be deleted. Implement in Slice D.

20. **Slice H security review checklist**: the security review in Slice H must produce an artifact at `docs/review/<date>-mcp-security-review.md` confirming each item in the named checklist in Section 11.2.

21. **Elicitation for destructive confirms (Claude Code ≥ 2.1.76)**: The MCP spec supports `server.elicitInput()` for inline native confirmation dialogs. This is preferred over the `DESTRUCTIVE_CONFIRM_REQUIRED` error round-trip when the host supports it. Elicitation MUST be handled at the server registration layer in `server.ts` — not inside `executeTool()`, because `executeTool` has no access to the server object. The dual-path pattern (see Section C.2) is required. Elicitation MUST NOT be used to request API keys, tokens, or secrets — those go through config only. Implement in Slice C.

## 7. Exit Code And Error Structure

Every tool error must follow this shape, returned as an MCP content block with `isError: true`:

```json
{
  "ok": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Contact with ID contact_01 was not found.",
    "hint": "Verify the record_id is correct.",
    "recovery": "Use search_records to find the correct record ID first."
  }
}
```

Named error codes used in MCP:

| Code | Condition |
|------|-----------|
| `RESOURCE_NOT_FOUND` | SDK 404 |
| `VALIDATION_FAILED` | Input Zod parse failure or SDK validation error |
| `AUTH_INVALID` | Invalid or missing API key in HTTP transport |
| `DESTRUCTIVE_CONFIRM_REQUIRED` | `confirm: true` missing on delete |
| `UNSUPPORTED_OBJECT_TYPE` | `object_type` not in dispatch map for the requested operation |
| `DEPENDENCY_NOT_AVAILABLE` | Gated tool stub |
| `INTERNAL_ERROR` | Unexpected SDK/transport error |
| `SSRF_BLOCKED` | Webhook URL blocked by SSRF policy |
| `UNKNOWN_TOOL` | `executeTool` called with unrecognized tool name |

## 8. File-to-Slice Mapping

Every file the MCP package requires is assigned to exactly one slice.

| File | Slice | Notes |
|------|-------|-------|
| `package.json` | A | see Slice A manifest requirements |
| `tsconfig.json` | A | extends root; no jsx needed |
| `vitest.config.ts` | A | see Slice A requirements |
| `src/index.ts` | A | package entry, `startMcpServer` re-export |
| `src/server.ts` | A | `startMcpServer()` implementation |
| `src/errors.ts` | B | `toToolError()`, `McpNotImplementedError`, error codes |
| `src/tools/schemas.ts` | B | shared Zod schemas, `defineTool()` helper |
| `src/tools/registry.ts` | B | `buildTools()`, `executeTool()` dispatch |
| `src/output/truncation.ts` | B | text truncation + `truncated: true` marker helper |
| `src/output/sensitive.ts` | B | sanitized DTOs for secret-bearing objects |
| `src/tools/core-records.ts` | C | `search_records`, `get_record`, `create_record`, `update_record`, `delete_record` |
| `src/tools/relationships.ts` | C | `relate_records` (live); `list_related_records` (stub — gated, see Section 3.2) |
| `src/tools/bulk.ts` | C | `bulk_operation` |
| `src/tools/pipelines.ts` | D | `get_pipelines`, `move_deal_stage`, `get_pipeline_stats` |
| `src/tools/activities.ts` | D | `log_activity`, `list_activities` |
| `src/tools/sequences.ts` | D | `enroll_in_sequence`, `unenroll_from_sequence` |
| `src/tools/team.ts` | D | `assign_record` |
| `src/transports/stdio.ts` | E | stdio transport entrypoint |
| `src/resources/team-members.ts` | E | `orbit://team-members` resource |
| `src/resources/schema.ts` | E | `orbit://schema` resource |
| `src/transports/http.ts` | F | HTTP transport entrypoint, bearer auth |
| `src/tools/schema.ts` | G | `get_schema`, `create_custom_field`, `update_custom_field` |
| `src/tools/imports.ts` | G | `import_records`, `export_records` (stubs) |
| `src/tools/analytics.ts` | G | `run_report`, `get_dashboard_summary` (stubs) |

## 9. Delivery Slices

### Slice A. Package Bootstrap And MCP Server Skeleton

Goal:

- create `packages/mcp` and lock the runtime seam before tool breadth begins

#### A.1 Package Manifest Requirements

```json
{
  "name": "@orbit-ai/mcp",
  "version": "0.1.0-alpha.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": { ".": "./dist/index.js" },
  "files": ["dist/", "README.md", "LICENSE"],
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@orbit-ai/sdk": "workspace:*",
    "zod": "^4.1.11"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

Pin `@modelcontextprotocol/sdk` to `^1.0.0`. Check npm for the latest 1.x stable at implementation time. Do not use 0.x — the API changed significantly at 1.0. The package name is `@modelcontextprotocol/sdk` — verify the exact import paths (`/server/index.js`, `/types.js`) still apply in the version you install.

#### A.2 TypeScript Config Requirements

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

No `.tsx` needed — MCP has no UI components.

#### A.3 `startMcpServer` Signature

The server entry accepts a preconfigured `OrbitClient`:

```typescript
export async function startMcpServer(options: {
  client: import('@orbit-ai/sdk').OrbitClient
  transport: 'stdio' | 'http'
  port?: number
  bindAddress?: string
}): Promise<void>
```

stdio mode uses the provided client without constructing a new one. When the CLI calls `orbit mcp serve`, it constructs the `OrbitClient` from its own config resolution (same env-var precedence as the CLI plan) and passes it in. The MCP package itself does not read `ORBIT_API_KEY` or `.orbit/config.json` — that is the CLI's responsibility.

#### A.4 Vitest Config Requirements

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: { enabled: false },
  },
})
```

#### A.5 Required Tests (Slice A)

File: `src/__tests__/server.test.ts`

- `startMcpServer` with `transport: 'stdio'` does not throw on construction.
- `startMcpServer` with `transport: 'http'` and a valid port does not throw on construction.
- Passing no client throws synchronously with a clear error message.

Exit criteria:

- the package exists and can host a shared tool runtime without transport-specific divergence

---

### Slice B. Tool Definition Helpers, Error Mapping, And Registry Guardrails

Goal:

- make the core registry mechanically safe before individual tool breadth lands

#### B.1 `defineTool()` Helper

Wraps `@modelcontextprotocol/sdk`'s `Tool` type. Zod v4 ships a native `z.toJSONSchema(schema)` method. Use that directly — do **not** add `zod-to-json-schema` as a dependency. That package targets Zod v3 and does not support Zod v4 schemas. Every tool definition goes through `defineTool()` which calls `z.toJSONSchema(inputZodSchema)` for `inputSchema` — no manually written JSON Schema.

#### B.2 `executeTool()` Dispatch And Build-Order Stub Pattern

The dispatch table maps tool names to handler functions. Calling with an unknown tool name must return a structured `UNKNOWN_TOOL` error, not throw:

```typescript
export async function executeTool(
  client: OrbitClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult>
```

**Build-ordering requirement**: `buildTools()` in `registry.ts` (Slice B) must import all 23 tool definitions, including those in `src/tools/schema.ts`, `src/tools/imports.ts`, and `src/tools/analytics.ts` (Slice G). Since those files do not exist when Slice B is implemented, Slice B must create placeholder stub exports for every Slice-G tool:

```typescript
// Created in Slice B as stubs; replaced by full implementations in Slice G
// src/tools/schema.ts (stub):
export const getSchemaTool = defineTool('get_schema', { ... annotations ... })
export const createCustomFieldTool = defineTool('create_custom_field', { ... })
export const updateCustomFieldTool = defineTool('update_custom_field', { ... })

// src/tools/imports.ts (stub):
export const importRecordsTool = defineTool('import_records', { ... })
export const exportRecordsTool = defineTool('export_records', { ... })

// src/tools/analytics.ts (stub):
export const runReportTool = defineTool('run_report', { ... })
export const getDashboardSummaryTool = defineTool('get_dashboard_summary', { ... })
```

Stub handler: returns `McpNotImplementedError` with `code: 'DEPENDENCY_NOT_AVAILABLE'`. Slice G replaces the stub implementations — the `defineTool` metadata and stub handler are both replaced with real logic. This means `packages/mcp` always compiles after Slice B with all 23 tools registered and the count test passing.

#### B.3 `toToolError()` Requirements

Implementation must sanitize `error.message` per Principle 12. Must use the default `hint` and `recovery` strings from the spec when the underlying error lacks them. Must set `isError: true` on the returned content block.

#### B.4 Shared Schemas And `src/output/` Directory

Zod schemas for `ObjectTypeSchema`, `SearchObjectTypeSchema`, `CursorSchema`, `LimitSchema` exactly as in the spec. Add a shared `sanitizeStringInput(s: string, maxLength = 10_000): string` helper that truncates free-form inputs per Principle 14.

The `src/output/` subdirectory does not exist in the spec's directory manifest (the spec omits it). Slice B must create this directory explicitly when creating `src/output/truncation.ts` and `src/output/sensitive.ts`. The file-to-slice table in Section 8 is authoritative — the spec directory manifest is incomplete.

#### B.5 Required Review Gate

Contract review after Slice B: confirm the MCP package is structurally enforcing the fixed tool count, safety annotations, runtime Zod validation, and machine-readable output rules.

#### B.6 Required Tests (Slice B)

File: `src/__tests__/registry.test.ts`

1. `buildTools()` returns exactly 23 tools.
2. Every tool name is a non-empty string.
3. No duplicate tool names exist.
4. Every tool has `annotations.readOnlyHint`, `annotations.destructiveHint`, and `annotations.idempotentHint` — each a boolean.
5. `delete_record` has `annotations.destructiveHint === true`.
6. `search_records` and `get_record` have `annotations.readOnlyHint === true`.
7. `bulkOperationTool.annotations.destructiveHint === true`.
8. `buildTools()` returns the same tool names on successive calls (idempotency).
9. `executeTool(mockClient, 'totally_unknown_tool', {})` returns a content block with `isError: true` and `parsed.error.code === 'UNKNOWN_TOOL'` — does not throw.

File: `src/__tests__/errors.test.ts`

10. `toToolError({ code: 'RESOURCE_NOT_FOUND', message: 'Not found' })` returns `{ isError: true, content: [{ type: 'text', text: <json> }] }` with `parsed.ok === false` and `parsed.error.code === 'RESOURCE_NOT_FOUND'`.
11. `toToolError` with no `hint`/`recovery` on the input uses the spec's default strings.
12. `toToolError` with an error message containing a synthetic token string (`'ya29.FAKETOKEN'`) returns content that does NOT contain `'ya29.FAKETOKEN'`.
13. `toToolError` result `content[0].type === 'text'`.

Exit criteria:

- later slices can add tools without weakening registry invariants or error behavior

---

### Slice C. Core Record Tool Slice

Goal:

- land the highest-value universal tools first on top of stable SDK primitives

Scope: `search_records`, `get_record`, `create_record`, `update_record`, `delete_record`, `relate_records`, `bulk_operation`; `list_related_records` is registered in `src/tools/relationships.ts` as a `McpNotImplementedError` stub — it is gated (see Section 3.2) and must NOT call any SDK method

Files: `src/tools/core-records.ts`, `src/tools/relationships.ts`, `src/tools/bulk.ts`

#### C.1 `object_type` Dispatch Map

Use a named union type to avoid `keyof OrbitClient` (which includes non-resource properties like `options` and EventEmitter methods):

```typescript
type ResourceKey =
  | 'contacts' | 'companies' | 'deals' | 'activities' | 'tasks' | 'notes'
  | 'products' | 'payments' | 'contracts' | 'sequences' | 'sequenceSteps'
  | 'sequenceEnrollments' | 'sequenceEvents' | 'tags'
  | 'webhooks' | 'imports' | 'users' | 'stages' | 'pipelines'

const resourceMap: Record<string, ResourceKey> = {
  contacts: 'contacts',
  companies: 'companies',
  deals: 'deals',
  activities: 'activities',
  tasks: 'tasks',
  notes: 'notes',
  products: 'products',
  payments: 'payments',
  contracts: 'contracts',
  sequences: 'sequences',
  sequence_steps: 'sequenceSteps',
  sequence_enrollments: 'sequenceEnrollments',
  sequence_events: 'sequenceEvents',
  tags: 'tags',
  webhooks: 'webhooks',
  imports: 'imports',
  users: 'users',
  stages: 'stages',
  pipelines: 'pipelines',
}
```

An `object_type` not in this map returns `UNSUPPORTED_OBJECT_TYPE` immediately.

**`search_records` special-case for `object_type: 'all'`**: the `search_records` handler must handle `object_type: 'all'` before consulting `resourceMap`, because `'all'` is not an entity key:

```typescript
// In the search_records handler:
if (args.object_type === 'all') {
  return await client.search.query({ query: args.query, limit: args.limit, cursor: args.cursor })
}
// Otherwise dispatch to entity-specific search:
const resource = client[resourceMap[args.object_type]]
return await resource.search({ query: args.query, filter: args.filter, ... })
```

Never let `object_type: 'all'` fall through to the `UNSUPPORTED_OBJECT_TYPE` path.

#### C.2 `delete_record` Handler — Dual-Path Destructive Confirm

`confirm: true` is enforced by the handler's runtime Zod parse (Principle 11). The handler lives in `executeTool()` which has no server reference. Elicitation must be handled **before** `executeTool()` is called, in the tool registration wrapper inside `server.ts`:

```typescript
// In server.ts, when registering delete_record:
server.registerTool('delete_record', toolDef, async (args, _extra) => {
  if (!args.confirm) {
    const caps = server.getClientCapabilities()
    if (caps?.elicitation) {
      const r = await server.elicitInput({
        mode: 'form',
        message: `Permanently delete ${args.object_type} record ${args.record_id}? This cannot be undone.`,
        requestedSchema: {
          type: 'object',
          properties: { confirmed: { type: 'boolean', title: 'Confirm deletion' } },
          required: ['confirmed'],
        },
      })
      if (r.action === 'accept' && r.content?.confirmed) {
        args = { ...args, confirm: true }   // inject before executeTool
      } else {
        return toToolError({ code: 'DESTRUCTIVE_CONFIRM_REQUIRED', message: 'User declined or dismissed the confirmation.' })
      }
    }
    // Fallback: no elicitation support — executeTool will return DESTRUCTIVE_CONFIRM_REQUIRED
  }
  return executeTool(client, 'delete_record', args)
})
```

When `caps?.elicitation` is absent or false, fall through — `executeTool` returns `DESTRUCTIVE_CONFIRM_REQUIRED` via its own Zod parse, which is the pre-elicitation behavior and remains the documented fallback.

The `confirm?: boolean` field stays in the Zod input schema so that non-elicitation hosts can still pass `confirm: true` directly.

#### C.3 SSRF Guard For Webhook Writes

When the DirectTransport SDK client is in use, `create_record` and `update_record` for `object_type: 'webhooks'` must validate the `url` field against the SSRF block list (Principle 17) before calling the SDK. Return `SSRF_BLOCKED` for blocked URLs.

#### C.4 `relate_records` SDK Mapping

- `relationship_type: 'tag'` → `client.tags.attach(tagId, { entity_type, entity_id })` or `client.tags.detach(...)`. The `target_record_id` is the tag ID in this case.
- `relationship_type: 'contact_company' | 'contact_deal' | 'company_deal'` → targeted field update via `client.<entity>.update(id, { contact_id | company_id })`. Document in code comments that no dedicated link endpoint exists in the SDK.

#### C.5 `bulk_operation` Entity Gate

Before dispatching to `client.<entity>.batch(body)`, check whether the entity supports batch (Section 3.1). If not (e.g., `object_type: 'users'`), return `McpNotImplementedError` with `code: 'UNSUPPORTED_OBJECT_TYPE'` immediately.

Each delete operation within a batch must be validated individually with the runtime Zod parse — missing `confirm: true` on any single delete fails the entire batch.

In direct-mode stdio, emit pre-execution audit per Principle 19.

#### C.6 Required Review Gate

Tool-surface review after Slice C: confirm universal record operations are stable and do not leak transport or secret details.

#### C.7 Required Tests (Slice C)

File: `src/__tests__/core-records.test.ts`

Mock `OrbitClient` with `vi.fn()` — mock the resource methods, not `fetch`.

1. `get_record` with `object_type: 'contacts'` calls `client.contacts.get(record_id)` and returns a content block with `parsed.ok === true` and `parsed.data.id` matching the mock response.
2. `get_record` with an unsupported `object_type` returns `UNSUPPORTED_OBJECT_TYPE` error.
3. `create_record` calls the correct resource's `create()` method and returns envelope.
4. `update_record` calls `update()` on the correct resource.
5. `delete_record` with `confirm: true` calls `delete()` and returns success.
6. `delete_record` with `confirm: false` returns `DESTRUCTIVE_CONFIRM_REQUIRED`, does NOT call `delete()`.
7. `delete_record` with `confirm` omitted returns `DESTRUCTIVE_CONFIRM_REQUIRED`, does NOT call `delete()`.
8. `search_records` with `object_type: 'all'` calls `client.search.query()` — does NOT return `UNSUPPORTED_OBJECT_TYPE`.
8b. `search_records` with `object_type: 'contacts'` calls `client.contacts.search()` — does NOT call `client.search.query()`.
9. `relate_records` with `relationship_type: 'tag'` calls `client.tags.attach()`.
10. `relate_records` with `relationship_type: 'contact_company'` calls `client.contacts.update()` with `company_id`.
11. `bulk_operation` with delete operations validates each individual `confirm: true`.
12. `bulk_operation` for `object_type: 'users'` (unsupported) returns `UNSUPPORTED_OBJECT_TYPE`.
13. `create_record` for `object_type: 'webhooks'` in direct mode with a private-IP `url` returns `SSRF_BLOCKED`.
14. `delete_record` registration wrapper: when `caps.elicitation` is true and elicit returns `accept` + `confirmed: true`, `executeTool` is called with `confirm: true` and `delete()` is invoked.
15. `delete_record` registration wrapper: when `caps.elicitation` is true and elicit returns `decline`, returns `DESTRUCTIVE_CONFIRM_REQUIRED` and `delete()` is NOT invoked.

Dispatch coverage (parameterized):
16. `get_record` dispatches correctly for: `contacts`, `deals`, `companies`, `activities`, `tasks`.

Exit criteria:

- agents can discover and mutate core records without needing specialized tools first

---

### Slice D. Relationship And Workflow Tool Slice

Goal:

- add the semantic workflow tools only where the SDK/API seam already exists or is explicitly accepted

Scope: `get_pipelines`, `move_deal_stage`, `get_pipeline_stats`, `log_activity`, `list_activities`, `enroll_in_sequence`, `unenroll_from_sequence`, `assign_record`

Files: `src/tools/pipelines.ts`, `src/tools/activities.ts`, `src/tools/sequences.ts`, `src/tools/team.ts`

#### D.1 Exact SDK Calls Per Tool

- `get_pipelines` → `client.pipelines.list(query?)` — do NOT use `client.deals.pipeline()` which serves a different purpose
- `move_deal_stage` → `client.deals.move(deal_id, { stage_id })` — see Section 2.5 for `occurred_at`/`note` caveat; never use `client.deals.update({ stage_id })`
- `get_pipeline_stats` → `client.deals.stats(query?)`
- `log_activity` → `client.activities.log(body)` — NOT `create()`; `log()` posts to `/v1/activities/log`; `body` must include `type` and `occurred_at`
- `list_activities` → `client.activities.list(query?)`
- `enroll_in_sequence` → `client.sequences.enroll(sequence_id, { contact_id, ...body })` (see Section 2.2)
- `unenroll_from_sequence` → `client.sequenceEnrollments.unenroll(enrollment_id)` — see Section 2.6 for `reason`/`idempotency_key` caveat
- `assign_record` → `client.<entity>.update(record_id, { assigned_to_user_id: user_id })` — supported entities: contacts, companies, deals, tasks only

`list_activities` output must truncate `body` and `subject` fields to 5,000 characters per the general truncation rule.

`bulk_operation` with delete operations in direct mode: emit pre-execution audit log to stderr (Principle 19) before the first delete is dispatched.

#### D.2 Required Review Gate (implicit)

If any workflow or relationship seam is still missing from `@orbit-ai/sdk`, add it there first instead of backfilling directly inside MCP.

#### D.3 Required Tests (Slice D)

File: `src/__tests__/workflows.test.ts`

1. `move_deal_stage` calls `client.deals.move()`, does NOT call `client.deals.update()`.
2. `move_deal_stage` passes only `{ stage_id }` to `deals.move()` — `occurred_at` and `note` are stripped from the SDK call until the SDK type is extended (see Section 2.5).
3. `enroll_in_sequence` calls `client.sequences.enroll(sequence_id, { contact_id })` — not `client.sequenceEnrollments.create()`.
4. `unenroll_from_sequence` calls `client.sequenceEnrollments.unenroll(enrollment_id)` — not `client.sequenceEnrollments.delete()`.
5. `assign_record` for `object_type: 'contacts'` calls `client.contacts.update(record_id, { assigned_to_user_id })`.
6. `assign_record` for `object_type: 'stages'` (unsupported) returns `UNSUPPORTED_OBJECT_TYPE`.
7. `log_activity` calls `client.activities.log()` — NOT `create()` — with required `type` and `occurred_at` fields.
8. `list_activities` output truncates `body` fields longer than 5,000 characters.
9. `bulk_operation` delete operations in direct mode emit audit log before SDK call.
10. `bulk_operation` with mixed operations (create + delete): missing `confirm: true` on any delete fails entire batch.

Exit criteria:

- the agent-facing semantic tools exist only where they provide real abstraction over accepted workflows

---

### Slice E. Resources, Stdio Transport, And Trusted Local Runtime

Goal:

- make the local agent path usable before hosted HTTP transport breadth lands

Scope: `src/transports/stdio.ts`, `src/resources/team-members.ts`, `src/resources/schema.ts`

#### E.1 stdio Transport

stdio mode is the default for local agents. The preconfigured `OrbitClient` is passed in by the caller (CLI or embedding code). The MCP package does not construct its own client.

When the client is backed by `DirectTransport`, emit the direct-mode startup warning (Principle 15) before accepting any requests.

#### E.2 Resource Handlers

`orbit://team-members`:

```typescript
export async function readTeamMembers(client: OrbitClient) {
  const result = await client.users.list({ limit: 100 })
  return {
    contents: [{
      uri: 'orbit://team-members',
      mimeType: 'application/json',
      text: JSON.stringify({
        _type: 'orbit_resource',
        _untrusted: true,
        data: result.data.map(truncateUserFields),
      }, null, 2),
    }],
  }
}
```

`orbit://schema`:

```typescript
export async function readSchema(client: OrbitClient) {
  const result = await client.schema.listObjects()
  return {
    contents: [{
      uri: 'orbit://schema',
      mimeType: 'application/json',
      text: JSON.stringify({
        _type: 'orbit_resource',
        _untrusted: true,
        data: result,
      }, null, 2),
    }],
  }
}
```

Both resources must truncate individual string fields to 500 characters (Principle 18).

#### E.3 Required Review Gate

Agent-UX review after Slice E: confirm local tool discovery, resources, and error payloads are deterministic enough for agent use.

#### E.4 Required Tests (Slice E)

File: `src/__tests__/resources.test.ts`

1. `readTeamMembers` returns content with `uri: 'orbit://team-members'` and `mimeType: 'application/json'`.
2. `readTeamMembers` output wraps data in `{ _type: 'orbit_resource', _untrusted: true, data: [...] }`.
3. `readTeamMembers` truncates user string fields longer than 500 characters.
4. `readSchema` returns content with `uri: 'orbit://schema'` and `_untrusted: true` wrapper.

File: `src/__tests__/stdio-transport.test.ts`

5. stdio transport exposes the same `buildTools()` registry as HTTP (invoke `ListToolsRequestSchema` handler, assert tool count = 23).
6. stdio transport in direct mode emits a startup warning to stderr.

Exit criteria:

- local MCP can run end-to-end with the stable tool slice and resources

---

### Slice F. HTTP Transport And Hosted Runtime Boundary

Goal:

- add the hosted/remote transport without forking the tool contract

Scope: `src/transports/http.ts`

#### F.1 Auth Requirements

There is no separate Orbit token-validation HTTP endpoint. The only real auth seam is `adapter.lookupApiKeyForAuth(hash)` in `packages/api/src/middleware/auth.ts`, which hashes the raw token with SHA-256 and performs a local DB lookup. The MCP HTTP transport must use the same pattern.

`startMcpServer()` must accept an `adapter` option of type `RuntimeApiAdapter` (imported from `@orbit-ai/api`) when `transport: 'http'` is selected. The caller (CLI or embed) is responsible for constructing and passing in the adapter. The MCP package must not construct its own adapter.

Each HTTP request must be authenticated before the MCP request body is decoded:

1. Extract `Authorization: Bearer <token>` header. Missing or malformed → HTTP 401 immediately.
2. Hash the raw token with `crypto.subtle.digest('SHA-256', ...)` — the same `hashToken()` approach used in the API middleware.
3. Call `adapter.lookupApiKeyForAuth(hash)`. If null → HTTP 401. If key has `revokedAt !== null` or has expired → HTTP 401.
4. On success, extract `organizationId` and `scopes` from the key and attach them to the request context so tool handlers can scope SDK calls correctly.
5. Missing or invalid token → HTTP 401 with a structured JSON body before any tool executes.

**`startMcpServer` HTTP signature addition** (update the Section A.3 signature):

```typescript
export async function startMcpServer(options: {
  client: import('@orbit-ai/sdk').OrbitClient
  transport: 'stdio' | 'http'
  port?: number
  bindAddress?: string
  adapter?: import('@orbit-ai/api').RuntimeApiAdapter  // required when transport === 'http'
}): Promise<void>
```

If `transport === 'http'` and `adapter` is not provided, throw synchronously with a clear error before binding the port.

#### F.2 Binding Requirements

- Default bind address: `127.0.0.1`. Never `0.0.0.0` by default.
- `options.bindAddress` can override. If set to anything other than `127.0.0.1`, emit a stderr warning.

#### F.3 Transport Parity

The HTTP transport uses the same `buildTools()` and `executeTool()` as the stdio transport. No transport-specific tool definitions or handler branches.

In-memory test harness: construct a test helper `invokeListTools(server)` and `invokeCallTool(server, toolName, args)` that calls the MCP server's registered request handlers directly — without spawning actual stdio/HTTP processes. Use this harness for transport parity tests.

#### F.4 Required Review Gate

Transport-parity review after Slice F: confirm stdio and HTTP expose the same tools, resources, and error semantics.

#### F.5 Required Tests (Slice F)

File: `src/__tests__/http-transport.test.ts`

1. Request without `Authorization` header → HTTP 401, MCP-structured error body.
2. Request with invalid bearer token (mock API validation to return 401) → HTTP 401.
3. `ListToolsRequestSchema` handler via HTTP returns 23 tools (using in-memory harness).
4. Transport parity: `buildTools()` names from stdio handler == names from HTTP handler (sorted).
5. `CallToolRequestSchema` for `get_record` via HTTP returns same response structure as via stdio handler (using in-memory harness).
6. HTTP transport binds to `127.0.0.1` by default (assert `options.bindAddress` defaults to `'127.0.0.1'` in server config).

Exit criteria:

- both supported transports work against one core runtime

---

### Slice G. Schema, Import/Export, Analytics Tool Slice, And Secret Redaction Tests

Goal:

- complete the remaining 23-tool registry, implement schema tools where the seam exists, and stub gated tools; write all secret-redaction tests

Scope: `src/tools/schema.ts`, `src/tools/imports.ts`, `src/tools/analytics.ts`

#### G.1 Schema Tools

`get_schema` → `client.schema.listObjects()` (all) or `client.schema.describeObject(type)` (specific)
`create_custom_field` → `client.schema.addField(type, body)`
`update_custom_field` → `client.schema.updateField(type, fieldName, body)`

These tools must be gated if the schema engine is incomplete. If `client.schema.listObjects()` is not implemented, they must stub with `McpNotImplementedError`.

#### G.2 Gated Tool Stubs

`import_records`, `export_records`, `run_report`, `get_dashboard_summary` must all be registered in `buildTools()` and must all return a structured `McpNotImplementedError` when called (Section 3.2). Never throw. Never crash the session. Never omit from the registry.

#### G.3 Required Review Gate

Dependency review after Slice G: confirm the last tools are backed by real client seams rather than MCP-local assumptions.

#### G.4 Required Tests (Slice G)

File: `src/__tests__/gated-tools.test.ts`

For each gated tool name: `['import_records', 'export_records', 'run_report', 'get_dashboard_summary']`:

1. `executeTool(mockClient, toolName, { object_type: 'contacts' })` returns `{ isError: true }` with `parsed.error.code === 'DEPENDENCY_NOT_AVAILABLE'` — does NOT throw.

File: `src/__tests__/secret-redaction.test.ts`

2. `get_record` for `object_type: 'webhooks'` where the mock SDK response contains `signing_secret: 'whsec_SUPERSECRET'` → the content block text does NOT contain `'SUPERSECRET'` or `'signing_secret'`.
3. Constructing `McpIntegrationConnectionRead` from a raw object containing `access_token: 'ya29.REALTOKEN'` and `refresh_token: 'rt_REALREFRESH'` → the DTO JSON does NOT contain either token, and `credentials_redacted === true`.
4. `toToolError({ code: 'INTERNAL_ERROR', message: 'access_token: ya29.LEAKED' })` → content block text does NOT contain `'ya29.LEAKED'`.

Exit criteria:

- all 23 core tools exist and map to accepted underlying capabilities

---

### Slice H. Final Hardening, Composite-Runtime Guardrails, And Security Review

Goal:

- finish the MCP package with explicit safety, review, and future-extension boundaries

Scope: final docs, review artifacts, extension-tool boundary documentation

#### H.1 Required Behavior

- the core package remains fixed at 23 tools
- extension-tool guidance documented: extension tools use provider namespaces (`integrations.gmail.send_email`), registered only in composite server runtimes, never in core `buildTools()`
- `README.md` must document: direct-mode trust boundaries, startup warning behavior, HTTP transport auth model
- secret-redaction, truncation, and error-hint behavior all have test coverage (verified by review)

#### H.2 Required Review Gates

**Code review**: confirm no tool handler accesses core services or API routes directly; all execution goes through the SDK; all 23 tools are in `buildTools()`.

**Agent-tooling review**: selection quality of tool descriptions, deterministic outputs, `hint`/`recovery` guidance is actionable.

**Security review** — named checklist (must produce artifact at `docs/review/<date>-mcp-security-review.md`):

- [ ] Every tool handler validates `args` with its Zod schema at runtime before any SDK call (test reference required)
- [ ] `delete_record` handler rejects `{ confirm: false }` with `DESTRUCTIVE_CONFIRM_REQUIRED` — not a deletion (test reference required)
- [ ] Every delete in `bulk_operation` is individually Zod-validated at runtime (test reference required)
- [ ] `toToolError()` does not include token-shaped strings in output (test reference required: `errors.test.ts` case 12)
- [ ] `orbit://team-members` and `orbit://schema` responses are wrapped with `_untrusted: true`
- [ ] `create_record` for `webhooks` in direct mode validates `url` against SSRF block list (test reference required)
- [ ] stdio direct mode emits startup warning to stderr listing absent protections
- [ ] HTTP transport binds to `127.0.0.1` by default (test reference required)
- [ ] HTTP transport validates bearer tokens via Orbit API (not locally)
- [ ] `bulkOperationTool.annotations.destructiveHint === true` asserted in test (test reference required)
- [ ] Gated tools return `DEPENDENCY_NOT_AVAILABLE` structured errors — not runtime crashes (test reference required)
- [ ] All 23 tools are in `buildTools()` unconditionally

Exit criteria:

- the MCP package is accepted as a stable agent interface over the SDK and API contract

## 10. Validation Matrix

At minimum, the MCP branch must prove:

- `packages/mcp` exists and builds cleanly
- exactly 23 core tools are registered and the count is asserted in a test
- every tool includes required annotations and all are booleans — asserted in a test
- stdio and HTTP transports expose the same registry (transport parity test)
- tool handlers return `{ ok: true, data, meta }` content blocks
- tool errors always include `hint` and `recovery` with default fallbacks tested
- `toToolError()` does not echo token-shaped strings — tested with synthetic message
- `delete_record` with `confirm: false` returns a structured error — not a deletion
- `move_deal_stage` calls `client.deals.move()`, not `client.deals.update()`
- gated tools return `DEPENDENCY_NOT_AVAILABLE` structured errors — not runtime crashes
- `orbit://team-members` and `orbit://schema` resources wrap data with `_untrusted: true`
- `create_record` for `webhooks` in direct mode validates SSRF block list
- no tool bypasses the SDK to recreate business logic in MCP

## 11. Branch Exit Criteria

The MCP implementation branch is complete when:

1. `packages/mcp` exists, builds cleanly, and starts in stdio and HTTP modes.
2. The fixed 23-tool registry is implemented, all in `buildTools()` unconditionally, and test-guarded with count + annotation + idempotency assertions.
3. Tool outputs and tool errors are structured, deterministic, and review-accepted.
4. Required MCP resources are implemented with `_untrusted: true` framing.
5. Final code, tooling, and security reviews return no blocking findings (all 12 security checklist items confirmed).
6. Any still-missing dependencies for schema/export/analytics are gated as `McpNotImplementedError` stubs — not omitted and not simulated.
7. **The MCP package reaches a minimum of 92 tests**:

| Test area | Approx count |
|-----------|-------------|
| Server construction and startup (Slice A) | 5 |
| Registry count, annotations, idempotency, dispatch (Slice B) | 15 |
| `toToolError()` and error codes (Slice B) | 5 |
| Core record tool handlers + dispatch coverage (Slice C) | 22 |
| Workflow tool handlers (Slice D) | 10 |
| Resource handlers and stdio transport (Slice E) | 6 |
| HTTP transport auth and parity (Slice F) | 6 |
| Gated tool stubs and secret redaction (Slice G) | 8 |
| Final integration / smoke (Slice H) | 5 |

This brings the projected repo total to approximately 884 tests (current baseline: 794 after CLI target).
