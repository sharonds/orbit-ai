# Sequence Event Entity

Fields:
- `id`: `seqevt_*` text ID
- `organizationId`: tenant scope
- `sequenceEnrollmentId`: required linked enrollment
- `sequenceStepId`: nullable linked step
- `eventType`: event kind
- `payload`: JSON payload
- `occurredAt`: event timestamp
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- linked `sequenceEnrollmentId` must resolve inside the same tenant
- linked `sequenceStepId`, when present, must belong to the same sequence graph as the enrollment
- service semantics are append/read oriented

Service surface:
- `create`
- `get`
- `list`
- `search`
