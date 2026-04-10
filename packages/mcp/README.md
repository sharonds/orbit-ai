# @orbit-ai/mcp

Orbit AI's Model Context Protocol server.

This package exposes the fixed 23-tool Orbit MCP surface over the accepted SDK and API contracts.

Runtime requirement:

- `@orbit-ai/mcp` currently requires Node.js 22+.

Direct mode trust boundary:

- Direct mode is for trusted local embeddings only.
- It bypasses API-layer authentication, per-org rate limiting, scope enforcement, and API-layer webhook SSRF validation. API-layer webhook SSRF validation is bypassed, but direct-mode SSRF checks are applied locally before any webhook create/update operation.
- The server emits a stderr warning whenever the SDK client is adapter-backed without an API key (direct mode). In HTTP transport mode this warning fires per authenticated request, because each request constructs a per-request OrbitClient with adapter and orgId but no apiKey.

HTTP transport:

- Defaults to binding `127.0.0.1`.
- Requires bearer authentication backed by `RuntimeApiAdapter.lookupApiKeyForAuth()`.
- Wildcard binding requires explicit `bindAddress` and emits a stderr warning.

Extension tools:

- The core package remains fixed at 23 tools.
- Integration-specific extension tools must be registered only in composite runtimes and use provider namespaces such as `integrations.gmail.send_email`.
