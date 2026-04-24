# @orbit-ai/cli

Terminal interface for Orbit AI CRM.

**Status**: `0.1.0-alpha`.

## Installation

```bash
pnpm add -g @orbit-ai/cli
# or
npm install -g @orbit-ai/cli
```

Requires **Node.js 22+**.

## Quick Start

```bash
# API mode (default) — requires a running @orbit-ai/api server
export ORBIT_API_KEY=your-key
export ORBIT_API_BASE_URL=https://api.yourapp.com
orbit contacts list

# Direct mode — connects to a local database (no server required)
orbit --mode direct --adapter sqlite --database-url ./orbit.db contacts list
```

## Global Flags

These flags apply to every command:

| Flag | Default | Description |
|---|---|---|
| `--mode <mode>` | `api` | Client mode: `api` (HTTP) or `direct` (local database) |
| `--adapter <type>` | — | Storage adapter in direct mode: `sqlite` or `postgres` |
| `--database-url <url>` | — | Database URL in direct mode (e.g. `./orbit.db` or a Postgres DSN) |
| `--api-key <key>` | — | API key (prefer `ORBIT_API_KEY` env var) |
| `--base-url <url>` | — | API base URL (prefer `ORBIT_API_BASE_URL` env var) |
| `--org-id <id>` | — | Organization ID override |
| `--user-id <id>` | — | User ID override |
| `--format <format>` | `table` | Output format: `table`, `json`, `csv`, `tsv` |
| `--json` | — | Shorthand for `--format json` |
| `--profile <name>` | — | Load a named profile from config |
| `--quiet` | — | Suppress warnings |
| `--yes` | — | Skip interactive confirmations |

## Commands

### Setup

```bash
orbit init              # Initialize a project (.orbit/config.json)
orbit status            # Show connection status and adapter info
orbit doctor            # Run diagnostics and check configuration
orbit seed              # Seed the database with sample data
```

### Schema & Migrations

```bash
orbit schema list           # List all registered object types
orbit schema get <entity>   # Describe an object type and its custom fields

orbit migrate --preview     # Preview pending migrations
orbit migrate --apply       # Apply pending migrations
orbit migrate --rollback --id <migration-id> --yes  # Roll back a migration (destructive)

orbit fields list <entity>          # List custom fields on an entity
orbit fields create <entity>        # Add a custom field interactively
orbit fields delete <entity> <field-name>   # Delete a custom field (destructive, requires --yes)
```

### CRM Entities

All entity commands follow the same pattern: `orbit <entity> <verb> [args]`

```bash
orbit contacts list
orbit contacts get <id>
orbit contacts create
orbit contacts update <id>
orbit contacts delete <id> --yes

orbit companies list|get|create|update|delete
orbit deals list|get|create|update|delete
orbit users list|get|create|update|delete
orbit pipelines list|get|create|update|delete
orbit stages list|get|create|update|delete
orbit activities list|get|create|update|delete
orbit tasks list|get|create|update|delete
orbit notes list|get|create|update|delete
orbit products list|get|create|update|delete
orbit payments list|get|create|update|delete
orbit contracts list|get|create|update|delete
orbit sequences list|get|create|update|delete
orbit tags list|get|create|update|delete
orbit webhooks list|get|create|update|delete
```

### Pipeline & Deals

```bash
orbit deals move <id> --stage-id <stage-id>   # Move a deal to a different pipeline stage
```

### Search

```bash
orbit search <query>                     # Cross-entity text search
orbit search <query> --entity contacts   # Restrict to a single entity type
```

### Analytics

```bash
orbit dashboard                  # Show a summary dashboard
orbit log                        # Show recent activity log
# orbit report — not yet implemented (throws NOT_IMPLEMENTED)
```

### MCP Server

```bash
# orbit mcp serve — not yet available from the CLI
# Start the MCP server directly via @orbit-ai/mcp (see packages/mcp/README.md)
```

### Integrations

```bash
orbit integrations                             # List configured integrations
orbit integrations gmail configure             # Configure Gmail connector
orbit integrations gmail status                # Show Gmail connector status
orbit integrations google-calendar configure   # Configure Google Calendar connector
orbit integrations google-calendar status      # Show Google Calendar connector status
orbit integrations stripe configure            # Configure Stripe connector
orbit integrations stripe link-create          # Create a Stripe payment link
orbit integrations stripe sync                 # Sync payments
orbit calendar                                 # Alias placeholder for calendar integration
```

For Gmail and Google Calendar, prefer OAuth token input from environment variables, token files, or `--tokens-stdin`. Avoid passing refresh tokens directly with `--access-token` / `--refresh-token` because argv can be visible in process listings and shell history. Normal integration commands do not apply schema DDL; use `--apply-integrations-schema` only as an explicit setup/migration action.

### Imports

```bash
orbit imports list                                    # List import job records
orbit imports create --entity-type contacts           # Create an import record (metadata only — no file upload)
orbit imports get <id>                                # Get an import job record
```

## Configuration File

The CLI looks for config in two locations, merged together (project overrides user):

- **User config**: `~/.config/orbit/config.json` — API key, base URL, defaults
- **Project config**: `.orbit/config.json` (walks up from `cwd`) — org ID, profiles only

User config keys:

```json
{
  "mode": "api",
  "apiKey": "orb_...",
  "apiKeyEnv": "ORBIT_API_KEY",
  "baseUrl": "https://api.yourapp.com",
  "orgId": "org_01JXXXX",
  "userId": "usr_01JXXXX",
  "adapter": "sqlite",
  "databaseUrl": "./orbit.db",
  "orgName": "My Org",
  "profiles": {
    "staging": {
      "baseUrl": "https://staging-api.yourapp.com",
      "orgId": "org_staging"
    }
  }
}
```

> **Security:** Set permissions to `0600` on config files that contain API keys:
> `chmod 0600 ~/.config/orbit/config.json`

Project config (`.orbit/config.json`) only accepts `orgId`, `userId`, and `profiles`.

Switch profiles with `--profile staging`.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | API or network error |
| `2` | Validation or usage error |
| `3` | Configuration error |

## Direct Mode Trust Boundaries

When using `--mode direct`, the following API-layer protections are **not active**:

- Authentication — no API key validation
- Rate limiting — no throttling on bulk operations
- Scope enforcement — `--org-id` is trusted as-is
- SSRF protection — no outbound request filtering

Direct mode is intended for local development, scripts against a local SQLite database, or trusted server-side automation where the database is private. Do not expose direct mode to untrusted user inputs.

## License

MIT — see [LICENSE](LICENSE).
