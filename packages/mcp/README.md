# @orbit-ai/mcp

Orbit AI's Model Context Protocol server.

This package exposes the fixed 23-tool Orbit MCP surface over the accepted SDK and API contracts.

Direct mode trust boundary:

- Direct mode is for trusted local embeddings only.
- It bypasses API-layer authentication, per-org rate limiting, scope enforcement, and API webhook SSRF protections.
- The server emits a stderr warning when started against a DirectTransport-backed SDK client.

HTTP transport:

- Defaults to binding `127.0.0.1`.
- Requires bearer authentication backed by `RuntimeApiAdapter.lookupApiKeyForAuth()`.
- Wildcard binding requires explicit `bindAddress` and emits a stderr warning.

Extension tools:

- The core package remains fixed at 23 tools.
- Integration-specific extension tools must be registered only in composite runtimes and use provider namespaces such as `integrations.gmail.send_email`.
