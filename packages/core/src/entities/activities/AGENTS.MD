# Activity Entity

Fields:
- `id`: `activity_*` text ID
- `organizationId`: tenant scope
- `type`: activity kind
- `subject`: nullable short summary
- `body`: nullable long-form body
- `direction`: inbound/outbound/internal style marker
- `contactId`: optional linked contact
- `dealId`: optional linked deal
- `companyId`: optional linked company
- `durationMinutes`: optional duration
- `outcome`: nullable outcome label
- `occurredAt`: required event timestamp
- `loggedByUserId`: optional linked user
- `metadata`: JSON metadata
- `customFields`: JSON custom field storage
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- linked `contactId`, `companyId`, and `dealId` must resolve inside the same tenant when provided
- service reads and writes stay tenant-scoped by `organizationId`

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
