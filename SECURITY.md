# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `0.1.0-alpha.*` | ✅ Yes — this is the current pre-release series |
| Earlier versions | Not applicable — no earlier releases exist |

Once `0.1.0-alpha` leaves pre-release status, this table will be updated to reflect
which minor/patch releases receive security fixes.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Use **GitHub's Private Vulnerability Reporting** to report security issues:

1. Go to the [Security tab](https://github.com/sharonds/orbit-ai/security) of this repository
2. Click **"Report a vulnerability"**
3. Include:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce (a minimal proof-of-concept if possible)
   - The version(s) affected
   - Whether you have a suggested fix

You will receive an acknowledgement within **2 business days** and a status update
within **7 days** of the initial report. We will work with you to understand and
validate the issue before any public disclosure.

## Scope

**In scope:**

- Authentication and authorization bypass in `@orbit-ai/api`
- Multi-tenant data isolation failures (cross-org data access)
- SQL injection or similar injection vulnerabilities in storage adapters
- API key leakage or predictability issues
- Privilege escalation via the admin or bootstrap routes
- Vulnerabilities in the DirectTransport that allow bypassing tenant context

**Out of scope:**

- Vulnerabilities in third-party dependencies (report those upstream)
- Issues that require physical access to the server
- Social engineering attacks
- Denial of service via large payloads that exceed the documented `maxRequestBodySize`
  limit (this is a known tradeoff, not a vulnerability)
- Issues in packages not yet released (`@orbit-ai/cli`, `@orbit-ai/mcp`,
  `@orbit-ai/integrations`)

## Security model (summary)

Orbit AI uses a three-layer security model:

1. **API key authentication** — every request to `@orbit-ai/api` must present a valid
   API key in the `Authorization: Bearer <key>` header. Keys are SHA-256 hashed before
   storage (HMAC-SHA256 + server pepper is planned for v1 GA).

2. **Application-layer tenant isolation** — every entity service method accepts and
   enforces a `{ orgId, userId }` context. All queries include an `orgId` filter. There
   is no cross-tenant query path in the service layer.

3. **Database-layer RLS** — Postgres-family adapters (Postgres, Supabase, Neon) ship
   Row Level Security policies that enforce `orgId` filtering at the database level,
   providing defence-in-depth if the application layer is bypassed. SQLite has no RLS;
   only application-layer filtering applies.

For the security architecture see [`docs/security/security-architecture.md`](docs/security/security-architecture.md).
For the database hardening checklist see [`docs/security/database-hardening-checklist.md`](docs/security/database-hardening-checklist.md).

## Known alpha gaps

The following are **known limitations** of the current alpha, not undisclosed
vulnerabilities:

- API keys are SHA-256 hashed. HMAC-SHA256 with a server-side pepper is on the roadmap
  for v1 GA, which will resist offline dictionary attacks on a leaked hash database.
- Idempotency and rate limiting stores are **in-memory** and single-instance only.
  Multi-instance deployments must implement the `IdempotencyStore` interface.
- SQLite has no RLS — multi-tenant isolation relies entirely on application-layer
  filtering. SQLite is intended for local development and testing only.
- Search and batch mutation types exist in the type system but the full implementation
  is incomplete. Do not rely on them for production data.

The full list of known alpha limitations is in
[`AGENTS.MD`](AGENTS.MD#known-alpha-limitations).

## Credit

We will publicly credit researchers who responsibly disclose vulnerabilities in the
release notes and CHANGELOG (unless they prefer to remain anonymous).
