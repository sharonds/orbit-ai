# Sequence Enrollment Entity

Fields:
- `id`: `seqenr_*` text ID
  This prefix matches the canonical core ID registry and is intentional for Slice C.
- `organizationId`: tenant scope
- `sequenceId`: required linked sequence
- `contactId`: required linked contact
- `status`: enrollment lifecycle label
- `currentStepOrder`: current progress pointer
- `enrolledAt`: enrollment timestamp
- `exitedAt`: nullable exit timestamp
- `exitReason`: nullable exit reason
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- linked `sequenceId` and `contactId` must resolve inside the same tenant
- `(sequenceId, contactId, status)` must stay unique per organization
- the current uniqueness contract also means a contact can only have one enrollment row per `(sequenceId, status)` shape, so repeated `exited` history rows are intentionally not stored as separate enrollments in Slice C
- `status: 'exited'` requires `exitedAt`
- `exitReason` requires `exitedAt`

Design constraints:

The enrollment row is a **mutable singleton** per `(contact, sequence, status)` tuple. It does not accumulate historical rows; instead, it transitions through status states. The unique index `sequence_enrollments_active_idx` on `(sequence_id, contact_id, status)` enforces this: a contact can have at most one row per status within a sequence.

**Lifecycle model:**
1. A contact starts in `status: 'active'` for a given sequence.
2. The enrollment row is updated in-place as the contact progresses through steps.
3. When the contact exits, the row transitions to `status: 'exited'` with an `exitedAt` timestamp.
4. The `exited` row persists as a singleton — no new rows accumulate on repeat exits.

**Re-enrollment after exit:**
To re-enroll a contact in a sequence they previously exited:
- **Option A**: Update the existing `exited` row back to `status: 'active'` (soft reset)
- **Option B**: Delete the `exited` row first, then create a new `active` row

The unique constraint prevents creating a new `active` row while an `active` row already exists for the same `(sequence, contact)` pair.

**API and SDK implications:**
Client implementations must account for this lifecycle model. Callers cannot assume new enrollment rows accumulate per attempt — instead they work with a single mutable record per status state.

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
