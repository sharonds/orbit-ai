# Spec 5: `@orbit-ai/mcp`

Status: Ready for implementation
Package: `packages/mcp`
Depends on: `@orbit-ai/core`, `@orbit-ai/sdk`

## 1. Scope

`@orbit-ai/mcp` is Orbit’s agent-native interface. It exposes 23 tools across 8 tiers using Attio-style universal tools with `object_type` parameters, plus a small set of semantic workflow tools where abstraction helps agents.

Requirements:

- stdio and HTTP transports
- safety annotations on every tool
- tool descriptions optimized for LLM selection
- error responses with `hint` and `recovery`
- resource endpoints for reference data
- full reuse of core and SDK types

## 2. Package Structure

```text
packages/mcp/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── transports/
│   │   ├── stdio.ts
│   │   └── http.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── core-records.ts
│   │   ├── pipelines.ts
│   │   ├── activities.ts
│   │   ├── schema.ts
│   │   ├── imports.ts
│   │   ├── sequences.ts
│   │   ├── analytics.ts
│   │   └── team.ts
│   ├── resources/
│   │   └── team-members.ts
│   └── errors.ts
└── package.json
```

## 3. Tool Inventory

Exactly 23 tools:

### 3.1 Core Record Operations

1. `search_records`
2. `get_record`
3. `create_record`
4. `update_record`
5. `delete_record`
6. `relate_records`
7. `list_related_records`
8. `bulk_operation`

### 3.2 Pipeline Intelligence

9. `get_pipelines`
10. `move_deal_stage`
11. `get_pipeline_stats`

### 3.3 Activity Logging

12. `log_activity`
13. `list_activities`

### 3.4 Schema Management

14. `get_schema`
15. `create_custom_field`
16. `update_custom_field`

### 3.5 Import/Export

17. `import_records`
18. `export_records`

### 3.6 Sequences

19. `enroll_in_sequence`
20. `unenroll_from_sequence`

### 3.7 Analytics

21. `run_report`
22. `get_dashboard_summary`

### 3.8 Team

23. `assign_record`

## 4. Tool Design Rules

Every tool definition must include:

- `title`
- `description`
- `inputSchema`
- `annotations.readOnlyHint`
- `annotations.destructiveHint`
- `annotations.idempotentHint`

Descriptions must include:

- when to use the tool
- when not to use the tool
- required IDs or preconditions

Example:

```typescript
// packages/mcp/src/tools/core-records.ts
import { z } from 'zod'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const getRecordTool: Tool = {
  name: 'get_record',
  title: 'Get a single Orbit record',
  description:
    'Use this when you already know a record ID and need the current record details. Do not use this for discovery or free-text search; use search_records for that.',
  inputSchema: {
    type: 'object',
    properties: {
      object_type: {
        type: 'string',
        enum: ['contacts', 'companies', 'deals', 'pipelines', 'stages', 'activities', 'tasks', 'notes', 'products', 'payments', 'contracts', 'sequences', 'sequence_steps', 'sequence_enrollments', 'sequence_events', 'tags', 'webhooks', 'users'],
      },
      record_id: { type: 'string' },
      include: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['object_type', 'record_id'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
}
```

## 5. Universal Tool Inputs

### 5.1 `search_records`

`search_records` additionally accepts `object_type: "all"` for cross-entity search when the caller does not know the object class yet.

```json
{
  "object_type": "contacts",
  "query": "jane acme",
  "filter": { "status": "lead" },
  "sort": [{ "field": "updated_at", "direction": "desc" }],
  "limit": 10,
  "cursor": null,
  "include": ["company", "tags"]
}
```

### 5.2 `create_record`

```json
{
  "object_type": "deals",
  "record": {
    "title": "Acme renewal",
    "contact_id": "contact_01...",
    "stage_id": "stage_01...",
    "value": "12000.00",
    "currency": "USD"
  },
  "idempotency_key": "idem_01..."
}
```

### 5.3 `bulk_operation`

```json
{
  "object_type": "contacts",
  "operations": [
    { "action": "create", "record": { "name": "Jane Doe" } },
    { "action": "update", "record_id": "contact_01...", "record": { "status": "customer" } }
  ]
}
```

## 6. Tool Implementations

```typescript
// packages/mcp/src/tools/registry.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { buildTools, executeTool } from './runtime'

export function registerTools(server: Server, client: import('@orbit-ai/sdk').OrbitClient) {
  const tools = buildTools()

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return executeTool(client, request.params.name, request.params.arguments ?? {})
  })
}
```

`executeTool()` must use a simple dispatch table and return MCP content blocks, not prose-only blobs.

## 7. Semantic Tools

The semantic tools are intentionally specialized because they encode real CRM workflows agents frequently need.

### 7.1 `move_deal_stage`

Input:

```json
{
  "deal_id": "deal_01...",
  "stage_id": "stage_01...",
  "occurred_at": "2026-04-01T09:00:00.000Z",
  "note": "Customer approved budget"
}
```

This tool should call `crm.deals.move()`, not emulate the move by patching `stage_id`.

### 7.2 `log_activity`

Input:

```json
{
  "type": "email",
  "subject": "Proposal follow-up",
  "body": "Customer asked for revised pricing.",
  "contact_id": "contact_01...",
  "deal_id": "deal_01...",
  "occurred_at": "2026-04-01T09:00:00.000Z"
}
```

## 8. Error Contract

Tool failures must return structured content with:

- `code`
- `message`
- `hint`
- `recovery`

```typescript
// packages/mcp/src/errors.ts
export function toToolError(error: import('@orbit-ai/core').OrbitErrorShape) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            hint: error.hint ?? 'Check required parameters and retry.',
            recovery: error.recovery ?? 'Use get_schema to inspect valid fields before retrying.',
          },
        }, null, 2),
      },
    ],
    isError: true,
  }
}
```

Example recovery guidance:

- unknown object type: suggest `get_schema`
- invalid ID prefix: suggest the expected prefix
- missing relation target: suggest `search_records` for the related object type first

## 9. Tool Output Rules

Responses must:

- include both ID and human-readable name fields where available
- truncate long text fields over 5,000 characters
- set `truncated: true` when truncation occurs
- preserve envelopes in machine-readable JSON inside the content block

Example result:

```json
{
  "ok": true,
  "data": {
    "id": "contact_01...",
    "object": "contact",
    "name": "Jane Doe",
    "email": "jane@acme.com"
  },
  "meta": {
    "request_id": "req_01..."
  }
}
```

## 10. Resources

At minimum ship one MCP resource:

- `orbit://team-members`

It returns active users for the current organization to help agents assign work without listing tools first.

```typescript
// packages/mcp/src/resources/team-members.ts
export async function readTeamMembers(client: import('@orbit-ai/sdk').OrbitClient) {
  const result = await client.users.list({ limit: 100 }).firstPage()
  return {
    contents: [
      {
        uri: 'orbit://team-members',
        mimeType: 'application/json',
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  }
}
```

## 11. Transport Modes

### 11.1 Stdio

- default mode for local agents
- reads API key and base URL from env or CLI args
- zero additional auth layer beyond the Orbit client config

### 11.2 HTTP

- hosted transport for remote agents
- bearer auth required
- maps HTTP session identity to an Orbit client

```typescript
// packages/mcp/src/server.ts
export async function startMcpServer(options: {
  client: import('@orbit-ai/sdk').OrbitClient
  transport: 'stdio' | 'http'
  port?: number
}) {
  if (options.transport === 'stdio') return startStdioServer(options.client)
  return startHttpServer(options.client, options.port ?? 8787)
}
```

## 12. Tool-to-Core Mapping

- `search_records` -> `resource.search()`
- `get_record` -> `resource.get()`
- `create_record` -> `resource.create()`
- `update_record` -> `resource.update()`
- `delete_record` -> `resource.delete()`
- `relate_records` -> core relation service, usually via `entity_tags`, `contact_id`, or `company_id`
- `list_related_records` -> relationship endpoints
- `bulk_operation` -> batch endpoints
- `get_pipelines` -> `crm.pipelines.list()`
- `move_deal_stage` -> `crm.deals.move()`
- `get_pipeline_stats` -> `crm.deals.stats()`
- `log_activity` -> `crm.activities.create()` or `/v1/activities/log`
- `list_activities` -> `crm.activities.list()`
- `get_schema` -> `crm.schema.listObjects()` or `.describeObject()`
- `create_custom_field` -> `crm.schema.addField()`
- `update_custom_field` -> `crm.schema.updateField()`
- `import_records` -> `crm.<entity>.import()` once implemented, else import API
- `export_records` -> export API
- `enroll_in_sequence` -> sequence enrollment API
- `unenroll_from_sequence` -> enrollment exit API
- `run_report` -> reporting API
- `get_dashboard_summary` -> dashboard summary API
- `assign_record` -> targeted update on the relevant entity `assigned_to_user_id`

## 13. Acceptance Criteria

1. Exactly 23 tools are registered.
2. Universal record tools use `object_type`.
3. Every tool includes `readOnlyHint`, `destructiveHint`, and `idempotentHint`.
4. Errors always include `hint` and `recovery`.
5. Both stdio and HTTP transports work against the same tool registry.
6. Tool descriptions are explicit enough for LLM selection and mention when not to use the tool.
