---
name: orbit-bare-catch
enabled: false
event: file
pattern: catch\s*\(\w+\)\s*\{\s*\}
action: warn
---

⚠️ **Bare catch block detected**

Empty catch blocks silently swallow errors. This is a known orbit-ai anti-pattern.

❌ `catch (e) {}`
✅ `catch (e) { throw e; }` — rethrow
✅ `catch (e) { logger.error('context', e); throw e; }` — log + rethrow
✅ Use duck-type guard for ZodError: `if (e?.name === 'ZodError' && Array.isArray(e?.issues))`

Review the catch block before proceeding.
