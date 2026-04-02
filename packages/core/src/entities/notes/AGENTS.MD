# Note Entity

Fields:
- `id`: `note_*` text ID
- `organizationId`: tenant scope
- `content`: required note body
- `contactId`: optional linked contact
- `dealId`: optional linked deal
- `companyId`: optional linked company
- `createdByUserId`: optional linked user
- `customFields`: JSON custom field storage
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- linked `contactId`, `dealId`, and `companyId` must resolve inside the same tenant when provided
- service reads and writes stay tenant-scoped by `organizationId`

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
