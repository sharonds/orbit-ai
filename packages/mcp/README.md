# @orbit-ai/mcp

Model Context Protocol server for Orbit AI CRM. Exposes 23 tools over stdio or HTTP transports — connect directly to Claude Desktop, Cursor, Copilot, or any MCP-compatible host.

**Status**: `0.1.0-alpha`.

## Installation

```bash
pnpm add @orbit-ai/mcp @orbit-ai/core
# or
npm install @orbit-ai/mcp @orbit-ai/core
```

Requires **Node.js 22+**.

## Starting the Server

### stdio transport (Claude Desktop, Cursor, Copilot)

Start the server in stdio mode via the CLI:

```bash
ORBIT_API_KEY=your-key ORBIT_BASE_URL=https://api.yourapp.com orbit mcp serve
```

Or start it programmatically in HTTP mode and point your MCP host at the HTTP endpoint (see HTTP transport below).

### Configuring Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orbit": {
      "command": "orbit",
      "args": ["mcp", "serve"],
      "env": {
        "ORBIT_API_KEY": "your-key-here",
        "ORBIT_BASE_URL": "https://api.yourapp.com"
      }
    }
  }
}
```

### HTTP transport (remote or multi-tenant)

```typescript
import { startHttpTransport } from '@orbit-ai/mcp'

const runtime = await startHttpTransport({
  adapter,           // RuntimeApiAdapter with lookupApiKeyForAuth wired up
  client,            // OrbitClient template (per-request clients are created from this)
  port: 3001,        // default
  bindAddress: '127.0.0.1',  // default; use '0.0.0.0' only with network controls
})

console.log(`MCP HTTP server listening on ${runtime.address}:${runtime.port}`)
```

HTTP transport requires `Authorization: Bearer <api-key>` on every request. The API key is resolved via `adapter.lookupApiKeyForAuth()` — the same lookup used by `@orbit-ai/api`.

## Tool Reference

All 23 tools operate on the entity specified in the `entity` argument (e.g. `"contacts"`, `"deals"`).

### Core CRUD

| Tool | Description |
|---|---|
| `search_records` | Full-text search across a single entity type |
| `get_record` | Get a single record by ID |
| `create_record` | Create a new record |
| `update_record` | Patch an existing record |
| `delete_record` | Delete a record |

### Relationships

| Tool | Description |
|---|---|
| `relate_records` | Create a relationship between two records |
| `list_related_records` | List records related to a given record |

### Bulk

| Tool | Description |
|---|---|
| `bulk_operation` | Create, update, or delete multiple records in one call |

### Pipeline & Deals

| Tool | Description |
|---|---|
| `get_pipelines` | List pipelines and their stages |
| `move_deal_stage` | Move a deal to a different pipeline stage |
| `get_pipeline_stats` | Get win/loss and stage-distribution stats for a pipeline |

### Activities

| Tool | Description |
|---|---|
| `log_activity` | Log an activity (call, email, meeting, note) on any record |
| `list_activities` | List activities for a record or across the org |

### Schema & Custom Fields

| Tool | Description |
|---|---|
| `get_schema` | Inspect the schema for an entity, including custom fields |
| `create_custom_field` | Add a custom field to an entity |
| `update_custom_field` | Update safe custom field metadata (`label`, `description`) |

Destructive schema migration operations are intentionally not exposed as MCP tools in the alpha. Custom-field rename, type-change, delete, promote, data-losing updates, and checksum-bound migration preview/apply/rollback remain API/SDK/CLI-only until MCP destructive schema operations have separate elicitation and UX design. No `preview_schema_migration`, `apply_schema_migration`, or `rollback_schema_migration` tools are registered. If `update_custom_field` receives anything outside safe metadata, it returns a structured unsupported destructive-operation error instead of executing.

### Imports & Exports

| Tool | Description |
|---|---|
| `import_records` | Bulk-import records from a JSON payload |
| `export_records` | Export records to a JSON payload |

### Sequences

| Tool | Description |
|---|---|
| `enroll_in_sequence` | Enroll a contact in a sequence |
| `unenroll_from_sequence` | Remove a contact from a sequence |

### Analytics

| Tool | Description |
|---|---|
| `run_report` | Run a report (activity summary, pipeline health, etc.) |
| `get_dashboard_summary` | Get a top-level CRM dashboard summary |

### Team

| Tool | Description |
|---|---|
| `assign_record` | Assign a record to a team member |

## Extension Tools

The 23 core tools are fixed. Integration-specific tools (Gmail, Calendar, Stripe) are registered in composite runtimes and use the `integrations.<provider>.<action>` namespace:

```
integrations.gmail.send_email
integrations.gmail.sync_thread
integrations.calendar.list_events
integrations.calendar.create_event
integrations.stripe.create_payment_link
integrations.stripe.get_payment_status
```

Extension tools must be registered by the consuming application — they are not included when importing `@orbit-ai/mcp` alone.

## Transport Trust Boundaries

**Direct mode** (no adapter, no API key): bypasses API-layer auth, rate limiting, scope enforcement, and webhook SSRF validation. Local SSRF checks are still applied before any webhook create/update. Use only for trusted local embeddings.

**HTTP mode**: each request requires a valid Bearer token. Auth, scopes, and revocation are enforced per request. Binding to non-localhost emits a stderr warning.

## License

MIT — see [LICENSE](LICENSE).
