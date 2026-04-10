---
name: orbit-test-baseline
enabled: false
event: stop
action: warn
conditions:
  - field: transcript
    operator: not_contains
    pattern: pnpm.*test|pnpm -r test
---

⚠️ **No test run detected in this session**

Before finishing, verify tests still pass:

```bash
pnpm --filter @orbit-ai/core build   # if core changed
pnpm -r test                          # must be ≥ baseline count
```

Then update the test baseline in CLAUDE.md if the count changed.
If you already ran tests in a previous session or this was a docs-only change, you may proceed.
