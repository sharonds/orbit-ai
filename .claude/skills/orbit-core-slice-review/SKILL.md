---
name: orbit-core-slice-review
description: Reviews completed @orbit-ai/core milestone or slice diffs against the core execution plan, the core spec, and required validation evidence. Invoke this skill after integrating core slice work, especially when a change touches IDs, shared types, envelope helpers, bootstrap tables, adapter boundaries, auth lookup, tenant context, or slice-level test/build evidence. Use it before advancing from slice 1 into repository primitives or later milestones.
---

# Orbit Core Slice Review

This skill reviews completed `@orbit-ai/core` work against the agreed execution baseline. It is not a planning skill and not a schema-planning skill. Use it after code exists and a slice or milestone group has been integrated.

## When to skip this skill

- Documentation-only changes
- Isolated schema-planning work with no code diff yet
- Non-core package changes

## Step 1: Load context

Read only the parts needed for the slice under review:

1. `docs/execution/core-implementation-plan.md` — milestone map, slice definition, workstream ownership, validation gates
2. `docs/specs/01-core.md` — authoritative contract for IDs, shared types, tables, adapters, and authority boundaries
3. `docs/security/orbit-ai-threat-model.md` — especially T1, T2, T3, and T6 where relevant

If the slice includes adapter or tenant-boundary work, also load:

4. `.claude/skills/orbit-tenant-safety-review/SKILL.md`

If the slice includes schema or table changes, also load:

5. `.claude/skills/orbit-schema-change/SKILL.md`

## Step 2: Identify the review scope

Determine:

- which milestone or slice is being reviewed
- which files changed
- which workstream owned each file
- which validations the plan requires for that slice

If the diff spans multiple workstreams, confirm the integrated result still respects the slice boundary and has not pulled in later-milestone work.

## Step 3: Review against the execution baseline

Check these questions:

### Rule 1: The diff matches the intended slice

The implementation should only contain work that belongs to the accepted slice or milestone group. Flag scope creep if later-service, API, SDK, CLI, MCP, or integration work leaked in early.

### Rule 2: Workstream ownership stayed clean

Parallel work must keep non-overlapping write scopes. If multiple sub-agents modified the same ownership area without an explicit integration step, flag it as a risk even if the code still works.

### Rule 3: Shared contracts did not drift

If the diff touches:

- `ids/*`
- `types/*`
- envelope mapping helpers
- bootstrap tables
- adapter interfaces

then verify the result still matches the core spec exactly enough for API/SDK/CLI/MCP to consume later without contract rewrites.

### Rule 4: Validation evidence exists

Do not accept the slice on code inspection alone. Confirm the required evidence exists for the reviewed slice:

- build
- typecheck if applicable
- unit tests for the touched layer
- required contract tests from the plan
- generated-artifact drift check if relevant

For slice 1 specifically, confirm there is one Postgres-family integration-style proof for bootstrap migration plus tenant-context behavior together.

### Rule 5: Security review dependencies are satisfied

If the diff touches tenant boundaries, auth lookup, tenant tables, or secret-bearing objects, confirm the corresponding specialized review ran:

- `orbit-tenant-safety-review`
- `orbit-schema-change`

This skill does not replace those reviews. It checks that they happened and that the integrated slice still looks coherent after merge.

## Step 4: Produce the review note

Write a concise findings-first review with these sections:

### Scope reviewed

- slice or milestone under review
- changed workstreams
- included validation evidence

### Findings

If problems are found, list them as a flat list ordered by severity:

```text
- [HIGH] <description> — <file>:<line>
- [MEDIUM] <description> — <file>:<line>
```

Use these severities:

- **HIGH**: missing required validation evidence, scope drift that invalidates the slice gate, or contract drift likely to block downstream packages
- **MEDIUM**: ownership ambiguity, incomplete evidence, or minor mismatch with the plan that should be fixed before the next milestone

### Validation

State pass or fail for each item:

1. **Slice scope is respected**: Pass/Fail — [brief evidence]
2. **Workstream ownership stayed clean**: Pass/Fail — [brief evidence]
3. **Required build/test evidence exists**: Pass/Fail — [brief evidence]
4. **Shared contracts still match the core spec**: Pass/Fail or N/A — [brief evidence]
5. **Required specialized reviews ran where needed**: Pass/Fail or N/A — [brief evidence]
6. **Postgres-family proof exists when required**: Pass/Fail or N/A — [brief evidence]

### Outcome

End with one of:

- `READY FOR NEXT MILESTONE`
- `FIX BEFORE NEXT MILESTONE`

If any validation item fails, the outcome is `FIX BEFORE NEXT MILESTONE`.
