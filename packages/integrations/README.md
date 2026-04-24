# @orbit-ai/integrations

Integration connectors for Orbit AI CRM — Gmail, Google Calendar, and Stripe.

## Status

Alpha (`0.1.0-alpha`).

## Connectors

| Connector | OAuth | Operations | Sync | MCP Tools | CLI Commands |
|-----------|-------|------------|------|-----------|--------------|
| Gmail | ✓ | send, list, get | message → activity | send_email, sync_thread | configure, status |
| Google Calendar | ✓ | list, create, update, delete, availability | event → activity | list_events, create_event | configure, status |
| Stripe | API key | payment link, payment status | checkout → payment | create_payment_link, get_payment_status | link-create, sync |

## Architecture

- **Plugin contract**: `OrbitIntegrationPlugin` — install/uninstall/healthcheck lifecycle
- **Registry**: Dynamic plugin registration with `IntegrationRegistry`
- **Config**: Orbit CLI config plus provider OAuth token input from env, files, or stdin
- **Credential store**: `CredentialStore` interface backed by `integration_connections` with AES-256-GCM encryption
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
4. Application type: **Desktop app**.
5. Complete your OAuth consent flow outside the alpha CLI and collect the issued access and refresh tokens.
6. On first install, apply the integration schema explicitly while configuring credentials:

```bash
export ORBIT_CREDENTIAL_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
export ORBIT_GMAIL_ACCESS_TOKEN="..."
export ORBIT_GMAIL_REFRESH_TOKEN="..."
orbit --apply-integrations-schema integrations gmail configure --skip-validation
```

Alpha configuration persists the supplied access and refresh tokens encrypted in the `integration_connections` table. Avoid `--access-token` and `--refresh-token` in shared environments because command-line arguments can appear in shell history and process listings. Safer alternatives are `ORBIT_GMAIL_ACCESS_TOKEN` / `ORBIT_GMAIL_REFRESH_TOKEN`, `--access-token-env` / `--refresh-token-env`, token files with `0600` permissions, or `--tokens-stdin`.

7. Verify connectivity:

```bash
orbit integrations gmail status
```

**Scopes requested:** `gmail.readonly`, `gmail.send`, `gmail.labels`

---

### Google Calendar

**Prerequisites:** Same Google Cloud project as Gmail (or a separate one).

1. In Google Cloud Console → APIs & Services → Library, enable the **Google Calendar API**.
2. Reuse the OAuth client from Gmail, or create a new Desktop app credential.
3. Complete your OAuth consent flow outside the alpha CLI and collect the issued access and refresh tokens.
4. On first install, apply the integration schema explicitly while configuring credentials:

```bash
export ORBIT_CREDENTIAL_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
export ORBIT_GOOGLE_CALENDAR_ACCESS_TOKEN="..."
export ORBIT_GOOGLE_CALENDAR_REFRESH_TOKEN="..."
orbit --apply-integrations-schema integrations google-calendar configure --skip-validation
```

5. Verify:

```bash
orbit integrations google-calendar status
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

Google connector credentials are stored encrypted (AES-256-GCM) in `integration_connections`. Operators must set `ORBIT_CREDENTIAL_KEY` to a 64-character hex key before configuring or reading credentials. Token files, if used as CLI input, should be:

- Added to `.gitignore` if they live under the project
- Backed up outside the repo if using long-lived refresh tokens
- Set to `0600` permissions

Integration schema creation is an explicit operator action. Normal `configure` and `status` commands do not apply DDL; pass the CLI `--apply-integrations-schema` flag only during setup/migration when using a database that has not already installed the integration tables.
