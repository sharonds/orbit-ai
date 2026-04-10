---
name: orbit-cross-package-import
enabled: true
event: file
pattern: from\s+['"](\.\./)+[^'"]*packages/
action: block
---

🚫 **Cross-package relative import detected**

CLAUDE.md rule: "Never import across packages using relative paths — use @orbit-ai/* package names"

❌ `from '../../packages/core/src/types'`
✅ `from '@orbit-ai/core'`

Fix the import to use the package name, then retry.
