# Contracts Entity

- Tenant-scoped contract records linked to deals, contacts, and companies when present.
- Preserve status transitions along the document approval lifecycle without widening unrelated core contracts.
- `signedAt` is only valid for `signed` contracts and should be auto-populated on the first transition into that state.
