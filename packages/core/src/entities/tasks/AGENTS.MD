# Task Entity

Fields:
- `id`: `task_*` text ID
- `organizationId`: tenant scope
- `title`: required title
- `description`: nullable body
- `dueDate`: nullable due timestamp
- `priority`: priority label
- `isCompleted`: completion flag
- `completedAt`: nullable completion timestamp
- `contactId`: optional linked contact
- `dealId`: optional linked deal
- `companyId`: optional linked company
- `assignedToUserId`: optional linked user
- `customFields`: JSON custom field storage
- `createdAt`: record creation timestamp
- `updatedAt`: record update timestamp

Required relationships:
- linked `contactId`, `dealId`, and `companyId` must resolve inside the same tenant when provided
- `completedAt` may only be set when `isCompleted` is true

Service surface:
- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`
