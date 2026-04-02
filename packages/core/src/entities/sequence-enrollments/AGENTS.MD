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

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
