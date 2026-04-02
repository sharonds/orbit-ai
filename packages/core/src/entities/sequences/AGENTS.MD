# Sequence Entity

Fields:
- `id`: `sequence_*` text ID
- `organizationId`: tenant scope
- `name`: sequence name
- `description`: nullable description
- `triggerEvent`: nullable trigger marker
- `status`: lifecycle label
- `customFields`: JSON custom field storage
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- sequence reads and writes stay tenant-scoped by `organizationId`

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
