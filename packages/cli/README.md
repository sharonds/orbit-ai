# @orbit-ai/cli

Terminal interface for Orbit AI CRM.

## Quick Start

```bash
# API mode (default)
export ORBIT_API_KEY=your-key-here
orbit contacts list

# Direct mode (local database)
orbit --mode direct --adapter sqlite --database-url ./orbit.db contacts list
```

## Direct Mode Trust Boundaries

When using `--mode direct`, the following middleware protections are NOT active:

- **Authentication**: No API key validation. Any caller with access to the database can perform all operations.
- **Rate limiting**: Unlimited operations. Bulk deletes or inserts have no throttling.
- **Scope enforcement**: Organization isolation is entirely the caller's responsibility. Set `--org-id` correctly.
- **SSRF protection**: No outbound request filtering. Do not point direct mode at remote databases from untrusted inputs.

Direct mode is intended for local development, scripts running against a local SQLite database, or trusted server-side automation where the database is private. Do not expose direct mode to untrusted user inputs.

See `.orbit/config.json` for configuration options.
