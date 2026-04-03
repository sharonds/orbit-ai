# Idempotency Keys

Read-only admin/system service for idempotency metadata. Exposed as `system.idempotencyKeys`.

- `requestHash` and `responseBody` are REDACTED in admin reads (may contain replay material or cached responses)
- Uniqueness constraint: `(organizationId, key, method, path)`
- Do NOT add idempotency cache lookup, body-hash conflict detection, lock leasing, or replay behavior
- The idempotency middleware milestone owns those behaviors — this module is metadata visibility only
