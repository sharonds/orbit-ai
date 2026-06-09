---
"@orbit-ai/api": patch
---

Bump hono to ^4.12.21 (resolved 4.12.25) closing four moderate advisories: JWT middleware Authorization-scheme check, app.mount() undecoded path prefix, IP-restriction deny-rule bypass for non-canonical IPs, and cookie helper sameSite/priority sanitization. Updates both the root pnpm override and the @orbit-ai/api dependency.
