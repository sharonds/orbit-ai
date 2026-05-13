---
"@orbit-ai/api": patch
"@orbit-ai/cli": patch
"@orbit-ai/core": patch
"@orbit-ai/create-orbit-app": patch
"@orbit-ai/demo-seed": patch
"@orbit-ai/integrations": patch
"@orbit-ai/mcp": patch
"@orbit-ai/sdk": patch
---

Close 18 Dependabot alerts (4 high, 13 medium, 1 low) via dependency upgrades.

- Bump `hono` from `^4.12.14` to `^4.12.18` in `@orbit-ai/api`. The most
  user-relevant fix is `GHSA-p77w-8qqv-26rm`, where Hono's cache middleware
  was ignoring `Vary: Authorization` / `Vary: Cookie` and could leak
  responses across tenants. Eight additional medium-severity Hono fixes
  ship in the same range (JSX/CSS injection in `hono/jsx`, cookie name
  handling, `bodyLimit()` bypass, `toSSG()` path traversal, repeated-slash
  middleware bypass in `serveStatic`, IPv4-mapped IPv6 in `ipRestriction()`,
  and JWT NumericDate validation).
- Add pinned `pnpm.overrides` for four transitive dependencies that were
  flagged on `main`: `fast-uri` `^3.1.2` (host confusion, path traversal —
  high), `vite` `^7.3.2` (`server.fs.deny` bypass, dev-server WebSocket
  arbitrary file read — high), `postcss` `^8.5.10` (`</style>` XSS),
  `ip-address` `^10.1.1` (`Address6` HTML XSS). Each override is pinned
  to its current major to prevent a future lockfile refresh from picking
  up an incompatible major.
