# Core Wave 2 Slice C Review

Date: 2026-04-02
Branch: `core-wave-2-slice-c`
Base commit: `b9a3dcd`
Reviewed scope:
- [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
- `@orbit-ai/core` Slice C implementation for `sequences`, `sequence_steps`, `sequence_enrollments`, and `sequence_events`
- registry, tenant-scope, and SQLite/Postgres persistence proof updates required for Slice C

## Validation Evidence

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

All four passed after the final Slice C fixes.

## Code Review

Findings fixed during the branch pass:

- Initial Slice C insert validation required `sequenceEnrollments.enrolledAt` and `sequenceEvents.occurredAt` too early, which blocked the intended service-level defaults. The final Zod contracts now keep those fields optional on create so the service layer can stamp stable defaults.
- Initial Slice C graph validation only ran at event-creation time. Sub-agent review found that later `sequenceStep.sequenceId` and `sequenceEnrollment.sequenceId` / `contactId` updates could silently invalidate already-written history. The final services now block reparenting once history exists.
- Sub-agent review also found delete behavior was adapter-divergent: SQLite could orphan Slice C children while Postgres would reject the same delete through foreign keys. The final Slice C services now reject parent deletes while dependent graph records or event history exist, and SQLite now enables foreign-key enforcement so the Slice C graph stays aligned with Postgres semantics.
- Follow-up review found one missing lifecycle rule and two regression gaps. The final Slice C services now reject `status: 'exited'` without `exitedAt`, map duplicate sequence names to typed `CONFLICT` errors, and carry explicit regression coverage for the enrollment-only sequence delete guard plus sequence name uniqueness.

Final open findings:

- None.

Outcome: `PASS`

## Security Review

Boundary touched:

- tenant-scoped repositories for `sequences`, `sequence_steps`, `sequence_enrollments`, and `sequence_events`
- parent-child graph ownership rules across the automation graph
- append-style history behavior for `sequence_events`
- SQLite and Postgres schema bootstrap extensions for Slice C

Validated controls:

1. Tenant reads and writes still derive scope from trusted `ctx.orgId`
2. New Slice C tables are registered as tenant-scoped in [tenant-scope.ts](/Users/sharonsciammas/orbit-ai/packages/core/src/repositories/tenant-scope.ts)
3. `sequence_steps.sequenceId` must resolve inside the tenant and `stepOrder` stays unique within the parent sequence
4. `sequence_enrollments.sequenceId` and `contactId` must resolve inside the tenant and `(sequenceId, contactId, status)` stays unique per organization
   This is a deliberate Slice C history tradeoff: repeated reenrollment history is not modeled as multiple rows with the same terminal status.
5. `sequence_events.sequenceStepId`, when present, must belong to the same sequence graph as the referenced enrollment
6. Slice C now blocks step/enrollment reparenting and parent deletes once event history exists, preserving append-only history semantics
7. SQLite now enables foreign-key enforcement and the Slice C bootstrap defines the same parent references as Postgres for the automation graph
8. SQLite and Postgres persistence proofs both pass for the full Slice C entity set

Findings:

- No remaining concrete Slice C tenant-isolation, graph-ownership, or history-integrity issues were found after the final fixes.

Residual risks:

- Postgres schema bootstrap still does not emit tenant-table RLS DDL, and tenant tables still need a broader org-leading index review. Those are inherited hardening items and should land in a dedicated follow-up rather than be mixed into the Slice C service branch.
- Shared repository helpers still rely on repository factories to provide only compile-time table names; adding an explicit allowlist assertion remains a worthwhile hardening follow-up before more dynamic registration surfaces exist.
- Slice C intentionally does not add orchestration-specific transport methods such as enroll/unenroll commands; later API/SDK milestones need to decide whether those workflow actions are thin wrappers over the current CRUD/lifecycle model or a tighter contract.

Outcome: `PASS`

## Plan Vs Execution

Slice C matches the execution plan:

- added `sequences`, `sequenceSteps`, `sequenceEnrollments`, and append-style `sequenceEvents`
- added CRUD/list/search coverage for `sequences`, `sequenceSteps`, and `sequenceEnrollments`
- added append/read coverage for `sequenceEvents`
- enforced and tested parent-child graph invariants, including step order uniqueness, enrollment uniqueness, and event-to-step graph ownership
- added SQLite and Postgres persistence proofs for the new entity set
- preserved lazy registry wiring so pre-Slice-C callers do not pay new adapter requirements until the new services are accessed

No out-of-scope tagging, import, webhook, or admin/system metadata work was pulled forward.

Outcome: `PASS`

## Recommendation

Slice C is ready as the next accepted `@orbit-ai/core` milestone on `core-wave-2-slice-c`.

The next branch action should be to merge Slice C and then open Slice D on a fresh follow-up branch so tagging, imports, and delivery-metadata review stay isolated from the automation graph history. The remaining database-hardening carry-forwards should stay in a separate tenant-hardening branch or PR.
