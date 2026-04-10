---
name: orbit-plan-wrap-up
description: Use when finishing implementation of any orbit-ai plan, feature, or fix — before running pr-review-toolkit or creating a pull request. Triggers when all tasks in a plan are complete, tests are passing, and you are about to move to the PR step.
---

# Orbit Plan Wrap-Up

## Overview

After implementing a plan, several artifacts must be updated before a PR is created. Skipping this step leads to stale documentation, wrong test baselines, and missing changelog entries that block npm publication.

**Run this after all tasks are done and tests pass — before `pr-review-toolkit:review-pr` and `finishing-a-development-branch`.**

## Wrap-Up Checklist

Work through each section in order. Do not skip sections because "nothing changed there."

### 1. Test Baseline

```bash
pnpm -r test
```

Count the passing tests. If the number changed, update the baseline in `CLAUDE.md`:

```
**Test baseline**: <new count> tests
```

If tests decreased, stop — do not proceed to PR.

### 2. CLAUDE.md

Check each section for staleness:

- **Key Architecture Rules** — did this plan introduce a new rule or change an existing one?
- **Adding an Entity / Adding a Storage Adapter** — did you add a step, change the order, or discover a gotcha?
- **Gotchas** — any new edge cases, surprises, or non-obvious constraints discovered?
- **How We Work → Orbit-Specific Review Triggers** — any new trigger points for the orbit skills?

Only update what actually changed. Do not paraphrase existing content.

### 3. Memory

Open `/Users/sharonsciammas/.claude/projects/-Users-sharonsciammas-orbit-ai/memory/MEMORY.md` and check:

- **project_status.md** — update the branch, test count, and what was just completed
- **feedback_review_patterns.md** — did this plan surface a new pattern, anti-pattern, or correction worth remembering?

If nothing changed, skip. If something changed, update the file and the MEMORY.md index entry.

### 4. Package READMEs

If any of the following changed, update the corresponding README:

| What changed | README to update |
|---|---|
| New public method on a service or repository | `packages/core/README.md` |
| New or modified REST endpoint | `packages/api/README.md` |
| New or modified SDK resource method | `packages/sdk/README.md` |
| New CLI command (when CLI is built) | `packages/cli/README.md` |

Check each README reflects the current public surface. Do not describe implementation internals.

### 5. CHANGELOG.md

Every merged change must have a CHANGELOG entry under `## [Unreleased]`. Use the format:

```markdown
### Added
- Short description of what was added

### Changed
- Short description of what was changed

### Fixed
- Short description of what was fixed
```

If this plan is part of an npm-publish branch, also verify:
- `version` in each affected `package.json` matches the intended release
- `files` field in each `package.json` is correct: `["dist/", "README.md", "LICENSE"]` only

### 6. Spec Coverage Check

Read the original spec or plan document for this feature. For each requirement, confirm there is at least one commit that implements it. If any requirement was silently skipped, either implement it or document why it was deferred — do not leave it invisible.

Spec location: `docs/superpowers/specs/YYYY-MM-DD-<name>.md`
Plan location: `docs/superpowers/plans/YYYY-MM-DD-<name>.md`

## After This Checklist

Proceed to:
1. `pr-review-toolkit:review-pr` — 6 specialist agents (type-design, silent-failure, test coverage, etc.)
2. `superpowers:finishing-a-development-branch` — PR creation

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Skipping test baseline update | Next plan starts with wrong count; baseline drift goes unnoticed |
| Skipping CHANGELOG for "small" changes | npm publish is blocked; reviewers don't know what changed |
| Updating README with internal details | Consumers see implementation noise; README becomes a code mirror |
| Skipping spec coverage check | Requirements silently dropped, discovered only at milestone review |
| Running pr-review-toolkit before this | Review comments reference stale docs; second review cycle required |
