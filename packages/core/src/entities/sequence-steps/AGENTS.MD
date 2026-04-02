# Sequence Step Entity

Fields:
- `id`: `seqstep_*` text ID
- `organizationId`: tenant scope
- `sequenceId`: required parent sequence
- `stepOrder`: order within the parent sequence
- `actionType`: step action kind
- `delayMinutes`: delay before execution
- `templateSubject`: nullable outbound subject
- `templateBody`: nullable outbound body
- `taskTitle`: nullable task title
- `taskDescription`: nullable task description
- `metadata`: JSON metadata
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- linked `sequenceId` must resolve inside the same tenant
- `stepOrder` must stay unique within one sequence

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
