# Sequence Enrollment Entity

Fields:
- `id`: `seqenr_*` text ID
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
- `exitReason` requires `exitedAt`

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
