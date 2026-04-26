---
"@orbit-ai/core": patch
"@orbit-ai/api": patch
"@orbit-ai/sdk": patch
"@orbit-ai/cli": patch
"@orbit-ai/mcp": patch
---

Add the alpha schema migration safety surface across core, API, SDK, and CLI:
checksum-bound preview/apply/rollback, explicit migration authority gating,
rollbackability reporting, and executable destructive custom-field delete/rename
semantics. MCP intentionally continues to exclude destructive schema migration
tools until a separate elicitation UX exists.
