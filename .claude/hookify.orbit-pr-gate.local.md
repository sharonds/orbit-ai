---
name: orbit-pr-gate
enabled: true
event: bash
pattern: gh\s+pr\s+create
action: warn
---

🚦 **Pre-PR gate — orbit-plan-wrap-up required first**

Before creating this PR, confirm you've completed the wrap-up checklist:

1. ✅ Test baseline updated in CLAUDE.md (`pnpm -r test` — count ≥ current baseline)
2. ✅ CLAUDE.md updated (architecture rules, gotchas, workflow triggers)
3. ✅ Memory updated (project_status.md, feedback if applicable)
4. ✅ Package READMEs updated if public API changed
5. ✅ CHANGELOG.md has an entry under `[Unreleased]`
6. ✅ Spec coverage verified (every requirement has a commit)

If you haven't run `orbit-plan-wrap-up`, stop and do it now.
Then run `pr-review-toolkit:review-pr` before proceeding.
