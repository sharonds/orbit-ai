# Custom Field Definitions

Read-only admin/system service for schema metadata records. Exposed as `system.customFieldDefinitions`.

- No redaction needed — metadata-only entity
- Uniqueness constraint: `(organizationId, entityType, fieldName)`
- `fieldType` must be a valid `CustomFieldType` union member
- Do NOT add schema-apply, promoted-column DDL, or write enforcement in this module
- Full CRUD will be added in the schema-engine milestone, not here
