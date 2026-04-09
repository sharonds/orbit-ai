# MCP Security Review

Date: 2026-04-10
Scope: `packages/mcp`
Reviewer mode: implementation-backed checklist review after code fixes and independent sub-agent review
Status: Accepted

## Checklist

- [x] Every tool handler validates `args` with its Zod schema at runtime before any SDK call.
  Evidence: `packages/mcp/src/tools/registry.ts`, `packages/mcp/src/__tests__/core-records.test.ts`, `packages/mcp/src/__tests__/schema-tools.test.ts`
- [x] `delete_record` rejects missing or false `confirm` values and does not delete.
  Evidence: `packages/mcp/src/tools/core-records.ts`, `packages/mcp/src/__tests__/core-records.test.ts`
- [x] Every delete in `bulk_operation` is individually runtime-validated.
  Evidence: `packages/mcp/src/tools/bulk.ts`, `packages/mcp/src/__tests__/core-records.test.ts`, `packages/mcp/src/__tests__/workflows.test.ts`
- [x] `toToolError()` redacts token-shaped strings.
  Evidence: `packages/mcp/src/errors.ts`, `packages/mcp/src/__tests__/errors.test.ts`, `packages/mcp/src/__tests__/secret-redaction.test.ts`
- [x] `orbit://team-members` and `orbit://schema` are wrapped with `_untrusted: true`.
  Evidence: `packages/mcp/src/resources/team-members.ts`, `packages/mcp/src/resources/schema.ts`, `packages/mcp/src/__tests__/resources.test.ts`
- [x] Direct-mode webhook writes validate URL SSRF block rules, including `127.0.0.1`, RFC1918 space, link-local addresses, `169.254.169.254`, and bracketed IPv6 loopback.
  Evidence: `packages/mcp/src/server.ts`, `packages/mcp/src/__tests__/core-records.test.ts`, `packages/mcp/src/__tests__/server.test.ts`
- [x] stdio direct mode emits startup warnings describing missing protections.
  Evidence: `packages/mcp/src/server.ts`, `packages/mcp/src/__tests__/stdio-transport.test.ts`, `packages/mcp/src/__tests__/server.test.ts`
- [x] HTTP transport defaults to `127.0.0.1`.
  Evidence: `packages/mcp/src/transports/http.ts`, `packages/mcp/src/__tests__/http-transport.test.ts`
- [x] HTTP transport authenticates bearer tokens through `adapter.lookupApiKeyForAuth(hash)` before body decode.
  Evidence: `packages/mcp/src/transports/http.ts`, `packages/mcp/src/__tests__/http-transport.test.ts`
- [x] `bulk_operation` is marked destructive in tool annotations.
  Evidence: `packages/mcp/src/tools/bulk.ts`, `packages/mcp/src/__tests__/registry.test.ts`
- [x] Gated tools return structured `DEPENDENCY_NOT_AVAILABLE` errors.
  Evidence: `packages/mcp/src/tools/imports.ts`, `packages/mcp/src/tools/analytics.ts`, `packages/mcp/src/__tests__/gated-tools.test.ts`
- [x] All 23 tools remain present in `buildTools()` unconditionally.
  Evidence: `packages/mcp/src/tools/registry.ts`, `packages/mcp/src/__tests__/registry.test.ts`

## Findings

Independent review surfaced two implementation issues during this pass:

1. IPv6 loopback SSRF bypass via `http://[::1]/...`
2. Missing request-level HTTP error boundary for malformed JSON and downstream failures

Both were fixed before this review was accepted:

- `packages/mcp/src/server.ts` now blocks `[::1]`
- `packages/mcp/src/transports/http.ts` now wraps request handling and emits deterministic 400/500 JSON errors

## Residual Risk

- HTTP transport currently binds execution to the adapter-backed auth lookup by constructing a direct client scoped to the authenticated organization. That satisfies the current plan’s scoping requirement, but future hosted work may still want a stricter documented scope model before external exposure.
