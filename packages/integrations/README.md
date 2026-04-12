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

## Setup Guides

### Gmail

**Prerequisites:** A Google Cloud project with billing enabled.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Library.
2. Search for **Gmail API** and click Enable.
3. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID.
4. Application type: **Desktop app**. Download the credentials JSON.
5. Place the credentials file at `.orbit/gmail-credentials.json` in your project root.
6. Run the configuration command:

```bash
orbit integrations gmail configure
```

This opens a browser OAuth consent flow. On completion, the access and refresh tokens are stored encrypted at `.orbit/integrations.json`.

7. Verify connectivity:

```bash
orbit integrations gmail configure --help
```

**Scopes requested:** `gmail.readonly`, `gmail.send`, `gmail.labels`

---

### Google Calendar

**Prerequisites:** Same Google Cloud project as Gmail (or a separate one).

1. In Google Cloud Console → APIs & Services → Library, enable the **Google Calendar API**.
2. Reuse the OAuth credentials from Gmail, or create a new Desktop app credential.
3. Place credentials at `.orbit/calendar-credentials.json`.
4. Run:

```bash
orbit integrations calendar configure
```

5. Verify:

```bash
orbit integrations calendar list
```

**Scopes requested:** `calendar.readonly`, `calendar.events`

---

### Stripe

**Prerequisites:** A Stripe account.

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys.
2. Copy the **Secret key** (starts with `sk_live_` or `sk_test_`).
3. Run:

```bash
orbit integrations stripe configure
```

Enter the secret key when prompted. It is stored encrypted at `.orbit/integrations.json`.

4. (Optional) Set up a webhook endpoint so Stripe checkout events are synced to Orbit payment records:

```bash
orbit integrations stripe sync --webhook-url https://api.yourapp.com/webhooks/stripe
```

5. Verify:

```bash
orbit integrations stripe link-create --amount 2999 --currency eur --name "Consulting Call"
```

**API access level:** Secret key (full write access). Store securely — never commit `.orbit/integrations.json`.

---

## Credential Storage

All connector credentials are stored encrypted (AES-256-GCM) at `.orbit/integrations.json`. This file is created by the configure commands and should be:

- Added to `.gitignore`
- Backed up outside the repo if using long-lived refresh tokens
- Set to `0600` permissions: `chmod 0600 .orbit/integrations.json`
