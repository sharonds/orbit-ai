# @orbit-ai/integrations

Integration connectors for Orbit AI CRM — Gmail, Google Calendar, and Stripe.

## Status

Alpha (`0.1.0-alpha.0`) — not yet published to npm.

## Connectors

| Connector | OAuth | Operations | Sync | MCP Tools | CLI Commands |
|-----------|-------|------------|------|-----------|--------------|
| Gmail | ✓ | send, list, get | message → activity | send_email, sync_thread | — |
| Google Calendar | ✓ | list, create, update, delete, availability | event → activity | list_events, create_event | list, create, sync |
| Stripe | API key | payment link, payment status | checkout → payment | create_payment_link, get_payment_status | link-create, sync |

## Architecture

- **Plugin contract**: `OrbitIntegrationPlugin` — install/uninstall/healthcheck lifecycle
- **Registry**: Dynamic plugin registration with `IntegrationRegistry`
- **Config**: `.orbit/integrations.json` for enabling/disabling connectors
- **Credential store**: `CredentialStore` interface with AES-256-GCM encryption
- **Event bus**: Internal domain events with routing enforcement (provider ≠ customer events)
- **Retry**: Bounded exponential backoff with jitter for provider API calls

## Dependencies

- `@orbit-ai/core` — schema extensions, tenant scoping
- `@orbit-ai/sdk` — client operations
- `googleapis` — Gmail and Calendar APIs
- `google-auth-library` — OAuth2 token lifecycle
- `stripe` — Stripe API client

## Security

- Credentials encrypted at rest (AES-256-GCM)
- Webhook signature verification (Stripe `constructEvent`)
- Tenant-scoped data access (RLS policies)
- Provider error redaction (tokens, secrets stripped from logs)
