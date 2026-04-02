# Product Entity

Fields:
- `id`: `product_*` text ID
- `organizationId`: tenant scope
- `name`: catalog name
- `price`: money value
- `currency`: three-letter uppercase currency code
- `description`: nullable product details
- `isActive`: active catalog state
- `sortOrder`: tenant-local catalog ordering key
- `customFields`: JSON custom field storage
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required behavior:
- reads and writes stay tenant-scoped by `organizationId`
- list and search preserve catalog ordering by `sortOrder`
- active state updates are first-class and tested

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
