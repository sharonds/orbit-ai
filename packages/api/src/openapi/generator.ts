/**
 * OpenAPI 3.1 spec generator for Orbit AI API.
 *
 * Short-term scope:
 * - reads generic entity capabilities from the shared entity capability map
 * - includes selected dedicated import/webhook routes so the public spec does
 *   not regress while the broader registry-driven rebuild (T10) is pending
 * - response bodies reference the shared `Envelope` / `EnvelopePaginated` /
 *   `Error` schemas so consumers see meaningful contracts (T6)
 */

import { PUBLIC_ENTITY_CAPABILITIES } from '../routes/entity-capabilities.js'

export interface OpenApiInfo {
  title: string
  version: string
  description?: string
}

const ENVELOPE_REF = { $ref: '#/components/schemas/Envelope' }
const ENVELOPE_PAGINATED_REF = { $ref: '#/components/schemas/EnvelopePaginated' }
const ERROR_REF = { $ref: '#/components/schemas/Error' }

function jsonContent(schemaRef: Record<string, unknown>): Record<string, unknown> {
  return { 'application/json': { schema: schemaRef } }
}

function envelopeResponse(description: string): Record<string, unknown> {
  return { description, content: jsonContent(ENVELOPE_REF) }
}

function envelopeDataResponse(description: string, dataSchemaRef: Record<string, unknown>): Record<string, unknown> {
  return {
    description,
    content: jsonContent({
      allOf: [
        ENVELOPE_REF,
        {
          type: 'object',
          properties: {
            data: dataSchemaRef,
          },
        },
      ],
    }),
  }
}

function paginatedResponse(description: string): Record<string, unknown> {
  return { description, content: jsonContent(ENVELOPE_PAGINATED_REF) }
}

function errorResponse(description: string): Record<string, unknown> {
  return { description, content: jsonContent(ERROR_REF) }
}

const STANDARD_AUTH_ERRORS = {
  '401': errorResponse('Unauthorized — missing, invalid, or expired API key'),
  '403': errorResponse('Forbidden — API key lacks the required scope'),
  '429': errorResponse('Rate limited'),
  '500': errorResponse('Internal server error'),
}

const STANDARD_WRITE_ERRORS = {
  '400': errorResponse('Validation error — request body or query parameters failed schema validation'),
  ...STANDARD_AUTH_ERRORS,
  '409': errorResponse('Conflict — uniqueness violation or idempotency conflict'),
}

const STANDARD_GET_ERRORS = {
  ...STANDARD_AUTH_ERRORS,
  '404': errorResponse('Not found'),
}

const STANDARD_MIGRATION_ERRORS = {
  '400': errorResponse('Validation error — request body failed strict schema validation'),
  '409': errorResponse('Conflict — confirmation, checksum, idempotency, or migration precondition failure'),
  '412': errorResponse('Rollback precondition failed'),
  '503': errorResponse('Migration authority unavailable in this API process'),
  ...STANDARD_AUTH_ERRORS,
}

const checksumSchema = {
  type: 'string',
  pattern: '^[a-f0-9]{64}$',
  description: 'Checksum computed from adapter, authenticated org scope, and migration operations.',
}

const semanticValueSchema = {
  description: 'JSON-compatible semantic value.',
  oneOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'object', additionalProperties: true },
    { type: 'array', items: {} },
    { type: 'null' },
  ],
}

const validationSchema = {
  type: 'object',
  additionalProperties: semanticValueSchema,
}

const customFieldTypeSchema = {
  type: 'string',
  enum: ['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone', 'currency', 'relation'],
}

const fieldPatchProperties = {
  label: { type: 'string', minLength: 1 },
  description: { type: ['string', 'null'] },
  fieldType: customFieldTypeSchema,
  required: { type: 'boolean' },
  indexed: { type: 'boolean' },
  defaultValue: semanticValueSchema,
  options: { type: 'array', items: { type: 'string' } },
  validation: validationSchema,
}

const operationBaseProperties = {
  entityType: { type: 'string' },
  fieldName: { type: 'string' },
}

const schemaMigrationPublicOperationSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'entityType', 'fieldName', 'fieldType'],
      properties: {
        type: { const: 'custom_field.add' },
        ...operationBaseProperties,
        fieldType: customFieldTypeSchema,
        label: { type: 'string', minLength: 1 },
        description: { type: ['string', 'null'] },
        required: { type: 'boolean' },
        indexed: { type: 'boolean' },
        defaultValue: semanticValueSchema,
        options: { type: 'array', items: { type: 'string' } },
        validation: validationSchema,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'entityType', 'fieldName', 'patch'],
      properties: {
        type: { const: 'custom_field.update' },
        ...operationBaseProperties,
        patch: {
          type: 'object',
          additionalProperties: false,
          properties: fieldPatchProperties,
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'entityType', 'fieldName'],
      properties: {
        type: { const: 'custom_field.delete' },
        ...operationBaseProperties,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'entityType', 'fieldName', 'newFieldName'],
      properties: {
        type: { const: 'custom_field.rename' },
        ...operationBaseProperties,
        newFieldName: { type: 'string' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'entityType', 'fieldName'],
      properties: {
        type: { const: 'custom_field.promote' },
        ...operationBaseProperties,
        columnName: { type: 'string' },
        indexed: { type: 'boolean' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'tableName', 'columnName', 'columnType'],
      properties: {
        type: { const: 'column.add' },
        tableName: { type: 'string' },
        columnName: { type: 'string' },
        columnType: { type: 'string' },
        nullable: { type: 'boolean' },
        defaultValue: semanticValueSchema,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'tableName', 'columnName'],
      properties: {
        type: { const: 'column.drop' },
        tableName: { type: 'string' },
        columnName: { type: 'string' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'tableName', 'columnName', 'newColumnName'],
      properties: {
        type: { const: 'column.rename' },
        tableName: { type: 'string' },
        columnName: { type: 'string' },
        newColumnName: { type: 'string' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'tableName', 'indexName', 'columns'],
      properties: {
        type: { const: 'index.add' },
        tableName: { type: 'string' },
        indexName: { type: 'string' },
        columns: { type: 'array', minItems: 1, items: { type: 'string' } },
        unique: { type: 'boolean' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'tableName', 'indexName'],
      properties: {
        type: { const: 'index.drop' },
        tableName: { type: 'string' },
        indexName: { type: 'string' },
      },
    },
  ],
}

const schemaMigrationForwardOperationSchema = {
  oneOf: [
    ...schemaMigrationPublicOperationSchema.oneOf,
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'operation'],
      properties: {
        type: { const: 'adapter.semantic' },
        adapter: { type: 'string', enum: ['supabase', 'neon', 'postgres', 'sqlite'] },
        operation: {
          type: 'string',
          enum: [
            'copy_column_values',
            'rebuild_table',
            'refresh_rls',
            'sync_custom_field_metadata',
            'validate_constraints',
          ],
        },
        parameters: {
          type: 'object',
          additionalProperties: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' },
              { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] } },
              { type: 'null' },
            ],
          },
        },
      },
    },
  ],
}

export function generateOpenApiSpec(info: OpenApiInfo): Record<string, unknown> {
  const paths: Record<string, unknown> = {}

  for (const [entity, caps] of Object.entries(PUBLIC_ENTITY_CAPABILITIES)) {
    const capabilities = caps as { read: boolean; write: boolean; batch: boolean }
    const tag = entity.charAt(0).toUpperCase() + entity.slice(1)
    const singular = entity.replace(/s$/, '')

    if (capabilities.read) {
      paths[`/v1/${entity}`] = {
        get: {
          summary: `List ${entity}`,
          operationId: `list${tag}`,
          tags: [tag],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': paginatedResponse(`Paginated list of ${entity}`),
            ...STANDARD_AUTH_ERRORS,
          },
        },
      }

      paths[`/v1/${entity}/{id}`] = {
        get: {
          summary: `Get a ${singular}`,
          operationId: `get${tag}`,
          tags: [tag],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', description: 'Orbit prefixed ULID (e.g. contact_01ARZ...)' } },
          ],
          responses: {
            '200': envelopeResponse(`${singular} details`),
            ...STANDARD_GET_ERRORS,
          },
        },
      }
    }

    if (capabilities.write) {
      paths[`/v1/${entity}`] = {
        ...(paths[`/v1/${entity}`] as object),
        post: {
          summary: `Create a ${singular}`,
          operationId: `create${tag}`,
          tags: [tag],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: {
            '201': envelopeResponse(`${singular} created`),
            ...STANDARD_WRITE_ERRORS,
          },
        },
      }

      const idPath = paths[`/v1/${entity}/{id}`] as Record<string, unknown>
      idPath.patch = {
        summary: `Update a ${singular}`,
        operationId: `update${tag}`,
        tags: [tag],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', description: 'Orbit prefixed ULID (e.g. contact_01ARZ...)' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': envelopeResponse(`${singular} updated`),
          ...STANDARD_WRITE_ERRORS,
        },
      }

      idPath.delete = {
        summary: `Delete a ${singular}`,
        operationId: `delete${tag}`,
        tags: [tag],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', description: 'Orbit prefixed ULID (e.g. contact_01ARZ...)' } },
        ],
        responses: {
          // Orbit delete operations return a 200 envelope whose data is
          // { id, deleted: true } — see routes/entities.ts:64. The SDK
          // consumer already depends on this shape, so the spec must
          // match the runtime.
          '200': envelopeResponse(`${singular} deleted`),
          ...STANDARD_GET_ERRORS,
        },
      }
    }
  }

  // Dedicated imports routes
  paths['/v1/imports'] = {
    get: {
      summary: 'List imports',
      operationId: 'listImports',
      tags: ['Imports'],
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': paginatedResponse('Paginated list of imports'),
        ...STANDARD_AUTH_ERRORS,
      },
    },
    post: {
      summary: 'Create an import',
      operationId: 'createImport',
      tags: ['Imports'],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        '201': envelopeResponse('Import created'),
        ...STANDARD_WRITE_ERRORS,
      },
    },
  }

  paths['/v1/imports/{id}'] = {
    get: {
      summary: 'Get an import',
      operationId: 'getImport',
      tags: ['Imports'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': envelopeResponse('Import details'),
        ...STANDARD_GET_ERRORS,
      },
    },
  }

  // Dedicated webhooks routes
  paths['/v1/webhooks'] = {
    get: {
      summary: 'List webhooks',
      operationId: 'listWebhooks',
      tags: ['Webhooks'],
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': paginatedResponse('Paginated list of webhooks'),
        ...STANDARD_AUTH_ERRORS,
      },
    },
    post: {
      summary: 'Create a webhook',
      operationId: 'createWebhook',
      tags: ['Webhooks'],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        '201': envelopeResponse('Webhook created'),
        ...STANDARD_WRITE_ERRORS,
      },
    },
  }

  paths['/v1/webhooks/{id}'] = {
    get: {
      summary: 'Get a webhook',
      operationId: 'getWebhook',
      tags: ['Webhooks'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': envelopeResponse('Webhook details'),
        ...STANDARD_GET_ERRORS,
      },
    },
    patch: {
      summary: 'Update a webhook',
      operationId: 'updateWebhook',
      tags: ['Webhooks'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        '200': envelopeResponse('Webhook updated'),
        ...STANDARD_WRITE_ERRORS,
      },
    },
    delete: {
      summary: 'Delete a webhook',
      operationId: 'deleteWebhook',
      tags: ['Webhooks'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': envelopeResponse('Webhook deleted'),
        ...STANDARD_GET_ERRORS,
      },
    },
  }

  paths['/v1/webhooks/{id}/deliveries'] = {
    get: {
      summary: 'List webhook deliveries',
      operationId: 'listWebhookDeliveries',
      tags: ['Webhooks'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': paginatedResponse('Paginated list of webhook deliveries'),
        ...STANDARD_GET_ERRORS,
      },
    },
  }

  paths['/v1/webhooks/{id}/redeliver'] = {
    post: {
      summary: 'Redeliver a webhook',
      operationId: 'redeliverWebhook',
      tags: ['Webhooks'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': envelopeResponse('Webhook redelivery triggered'),
        ...STANDARD_GET_ERRORS,
      },
    },
  }

  // Schema object and migration routes
  paths['/v1/objects'] = {
    get: {
      summary: 'List object schemas',
      operationId: 'listObjects',
      tags: ['Schema'],
      responses: {
        '200': envelopeDataResponse('Schema object list', { type: 'array', items: { type: 'object' } }),
        ...STANDARD_AUTH_ERRORS,
      },
    },
  }

  paths['/v1/objects/{type}'] = {
    get: {
      summary: 'Describe an object schema',
      operationId: 'describeObject',
      tags: ['Schema'],
      parameters: [
        { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': envelopeDataResponse('Schema object definition', { type: 'object' }),
        ...STANDARD_GET_ERRORS,
      },
    },
  }

  paths['/v1/objects/{type}/fields'] = {
    post: {
      summary: 'Add a custom field',
      operationId: 'addObjectField',
      tags: ['Schema'],
      parameters: [
        { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: jsonContent({ type: 'object', additionalProperties: true }),
      },
      responses: {
        '201': envelopeDataResponse('Created custom field', { type: 'object' }),
        ...STANDARD_WRITE_ERRORS,
      },
    },
  }

  paths['/v1/objects/{type}/fields/{fieldName}'] = {
    patch: {
      summary: 'Update a custom field',
      operationId: 'updateObjectField',
      tags: ['Schema'],
      parameters: [
        { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'fieldName', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: jsonContent({ $ref: '#/components/schemas/SchemaMigrationUpdateFieldRequest' }),
      },
      responses: {
        '200': envelopeDataResponse('Updated field or applied migration result', {
          oneOf: [
            { type: 'object' },
            { $ref: '#/components/schemas/SchemaMigrationApplyResponse' },
          ],
        }),
        ...STANDARD_MIGRATION_ERRORS,
      },
    },
    delete: {
      summary: 'Delete a custom field',
      operationId: 'deleteObjectField',
      tags: ['Schema'],
      parameters: [
        { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'fieldName', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: false,
        content: jsonContent({ $ref: '#/components/schemas/SchemaMigrationDeleteFieldRequest' }),
      },
      responses: {
        '200': envelopeResponse('Field deleted'),
        ...STANDARD_MIGRATION_ERRORS,
      },
    },
  }

  paths['/v1/schema/migrations/preview'] = {
    post: {
      summary: 'Preview a schema migration',
      operationId: 'previewSchemaMigration',
      tags: ['Schema'],
      requestBody: {
        required: true,
        content: jsonContent({ $ref: '#/components/schemas/SchemaMigrationPreviewRequest' }),
      },
      responses: {
        '200': envelopeDataResponse('Schema migration preview', { $ref: '#/components/schemas/SchemaMigrationPreviewResponse' }),
        ...STANDARD_MIGRATION_ERRORS,
      },
    },
  }

  paths['/v1/schema/migrations/apply'] = {
    post: {
      summary: 'Apply a schema migration',
      operationId: 'applySchemaMigration',
      tags: ['Schema'],
      requestBody: {
        required: true,
        content: jsonContent({ $ref: '#/components/schemas/SchemaMigrationApplyRequest' }),
      },
      responses: {
        '200': envelopeDataResponse('Schema migration apply result', { $ref: '#/components/schemas/SchemaMigrationApplyResponse' }),
        ...STANDARD_MIGRATION_ERRORS,
      },
    },
  }

  paths['/v1/schema/migrations/{id}/rollback'] = {
    post: {
      summary: 'Rollback a schema migration',
      operationId: 'rollbackSchemaMigration',
      tags: ['Schema'],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: false,
        content: jsonContent({ $ref: '#/components/schemas/SchemaMigrationRollbackRequest' }),
      },
      responses: {
        '200': envelopeDataResponse('Schema migration rollback result', { $ref: '#/components/schemas/SchemaMigrationRollbackResponse' }),
        ...STANDARD_MIGRATION_ERRORS,
      },
    },
  }

  // Health + status endpoints
  paths['/health'] = {
    get: {
      summary: 'Health check',
      operationId: 'healthCheck',
      tags: ['System'],
      responses: {
        '200': {
          description: 'Service is healthy',
          content: jsonContent({
            type: 'object',
            properties: { status: { type: 'string', enum: ['ok'] } },
            required: ['status'],
          }),
        },
      },
    },
  }

  paths['/v1/status'] = {
    get: {
      summary: 'Authenticated status',
      operationId: 'status',
      tags: ['System'],
      responses: {
        '200': envelopeResponse('Authenticated status with org info'),
        ...STANDARD_AUTH_ERRORS,
      },
    },
  }

  return {
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description: info.description ?? 'Orbit AI — CRM infrastructure for AI agents',
    },
    servers: [{ url: '/', description: 'Orbit AI API' }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (sk_...)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'retryable'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Stable machine-readable error code (e.g. VALIDATION_FAILED, RESOURCE_NOT_FOUND, CONFLICT, RATE_LIMITED).',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable description of the error.',
                },
                retryable: {
                  type: 'boolean',
                  description: 'True when the same request can be retried after a backoff.',
                },
                field: {
                  type: 'string',
                  description: 'For validation errors: the input field that caused the failure.',
                },
                request_id: {
                  type: 'string',
                  description: 'Server-generated request identifier (req_…) — useful for log correlation.',
                },
                doc_url: {
                  type: 'string',
                  description: 'Link to documentation for this specific error code.',
                },
              },
            },
          },
        },
        EnvelopeMeta: {
          type: 'object',
          required: ['request_id', 'version', 'has_more'],
          properties: {
            request_id: { type: 'string' },
            version: {
              type: 'string',
              description: 'API version pinned via the Orbit-Version header (e.g. 2026-04-01).',
            },
            cursor: { type: 'string', nullable: true },
            next_cursor: { type: 'string', nullable: true },
            has_more: { type: 'boolean' },
          },
        },
        EnvelopeLinks: {
          type: 'object',
          properties: {
            self: { type: 'string' },
            next: { type: 'string' },
          },
        },
        Envelope: {
          type: 'object',
          required: ['data', 'meta', 'links'],
          description:
            'Standard Orbit response envelope. `data` is the operation result (object, array, or null for delete responses).',
          properties: {
            data: {},
            meta: { $ref: '#/components/schemas/EnvelopeMeta' },
            links: { $ref: '#/components/schemas/EnvelopeLinks' },
          },
        },
        EnvelopePaginated: {
          type: 'object',
          required: ['data', 'meta', 'links'],
          description:
            'Paginated Orbit response envelope. `data` is always an array; cursor pagination is reported via `meta.next_cursor` and `meta.has_more`.',
          properties: {
            data: { type: 'array', items: {} },
            meta: { $ref: '#/components/schemas/EnvelopeMeta' },
            links: { $ref: '#/components/schemas/EnvelopeLinks' },
          },
        },
        DestructiveSafeguards: {
          type: 'object',
          additionalProperties: false,
          properties: {
            environment: { type: 'string', enum: ['development', 'test', 'staging', 'production'] },
            environmentAcknowledged: { type: 'boolean' },
            backup: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'evidenceId'],
              properties: {
                kind: { type: 'string', enum: ['backup', 'snapshot', 'branch'] },
                evidenceId: { type: 'string', minLength: 1 },
                capturedAt: { type: 'string', format: 'date-time' },
              },
            },
            ledger: {
              type: 'object',
              additionalProperties: false,
              required: ['evidenceId'],
              properties: {
                evidenceId: { type: 'string', minLength: 1 },
                recordedAt: { type: 'string', format: 'date-time' },
              },
            },
            rollback: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['decision'],
                  properties: {
                    decision: { const: 'rollbackable' },
                    evidenceId: { type: 'string', minLength: 1 },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['decision', 'reason'],
                  properties: {
                    decision: { const: 'non_rollbackable' },
                    reason: { type: 'string', minLength: 1 },
                  },
                },
              ],
            },
          },
        },
        DestructiveConfirmation: {
          type: 'object',
          additionalProperties: false,
          required: ['destructive', 'checksum', 'confirmedAt'],
          properties: {
            destructive: { const: true },
            checksum: checksumSchema,
            confirmedAt: { type: 'string', format: 'date-time' },
            safeguards: { $ref: '#/components/schemas/DestructiveSafeguards' },
          },
        },
        SchemaMigrationPublicOperation: schemaMigrationPublicOperationSchema,
        SchemaMigrationForwardOperation: schemaMigrationForwardOperationSchema,
        SchemaMigrationTrustedScope: {
          type: 'object',
          additionalProperties: false,
          required: ['orgId'],
          properties: {
            orgId: { type: 'string', minLength: 1 },
            actorId: { type: 'string', minLength: 1 },
          },
          description: 'Trusted scope derived from the authenticated request context, never from request bodies.',
        },
        SchemaMigrationAdapterScope: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'dialect'],
          properties: {
            name: { type: 'string' },
            dialect: { type: 'string', enum: ['sqlite', 'postgres'] },
          },
        },
        SchemaMigrationConfirmationInstructions: {
          type: 'object',
          additionalProperties: false,
          required: ['required', 'instructions', 'destructiveOperations'],
          properties: {
            required: { type: 'boolean' },
            instructions: { type: 'string', minLength: 1 },
            destructiveOperations: { type: 'array', items: { type: 'string' } },
            checksum: checksumSchema,
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        DestructiveRollbackDecision: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['decision'],
              properties: {
                decision: { const: 'rollbackable' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['decision', 'reason'],
              properties: {
                decision: { const: 'non_rollbackable' },
                reason: { type: 'string', minLength: 1 },
              },
            },
          ],
        },
        SchemaMigrationPreviewRequest: {
          type: 'object',
          additionalProperties: false,
          required: ['operations'],
          properties: {
            operations: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/SchemaMigrationPublicOperation' },
            },
          },
        },
        SchemaMigrationApplyRequest: {
          type: 'object',
          additionalProperties: false,
          required: ['operations', 'checksum'],
          properties: {
            operations: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/SchemaMigrationPublicOperation' },
            },
            checksum: checksumSchema,
            confirmation: { $ref: '#/components/schemas/DestructiveConfirmation' },
            idempotencyKey: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
        SchemaMigrationRollbackRequest: {
          type: 'object',
          additionalProperties: false,
          properties: {
            checksum: checksumSchema,
            confirmation: { $ref: '#/components/schemas/DestructiveConfirmation' },
          },
        },
        SchemaMigrationUpdateFieldRequest: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...fieldPatchProperties,
            confirmation: { $ref: '#/components/schemas/DestructiveConfirmation' },
          },
        },
        SchemaMigrationDeleteFieldRequest: {
          type: 'object',
          additionalProperties: false,
          properties: {
            confirmation: { $ref: '#/components/schemas/DestructiveConfirmation' },
          },
        },
        SchemaMigrationPreviewResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['checksum', 'operations', 'destructive', 'summary', 'adapter', 'scope', 'confirmationInstructions', 'confirmationRequired', 'warnings'],
          properties: {
            checksum: checksumSchema,
            operations: {
              type: 'array',
              items: { $ref: '#/components/schemas/SchemaMigrationForwardOperation' },
            },
            destructive: { type: 'boolean' },
            summary: { type: 'string', minLength: 1 },
            adapter: { $ref: '#/components/schemas/SchemaMigrationAdapterScope' },
            scope: { $ref: '#/components/schemas/SchemaMigrationTrustedScope' },
            confirmationInstructions: { $ref: '#/components/schemas/SchemaMigrationConfirmationInstructions' },
            confirmationRequired: { type: 'boolean' },
            warnings: { type: 'array', items: { type: 'string' } },
          },
        },
        SchemaMigrationApplyResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['migrationId', 'checksum', 'status', 'appliedOperations', 'rollbackable', 'rollbackDecision'],
          properties: {
            migrationId: { type: 'string', minLength: 1 },
            checksum: checksumSchema,
            status: { type: 'string', enum: ['applied', 'noop'] },
            appliedOperations: {
              type: 'array',
              items: { $ref: '#/components/schemas/SchemaMigrationForwardOperation' },
            },
            rollbackable: { type: 'boolean' },
            rollbackDecision: { $ref: '#/components/schemas/DestructiveRollbackDecision' },
            idempotencyKey: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
        SchemaMigrationRollbackResponse: {
          type: 'object',
          additionalProperties: false,
          required: ['migrationId', 'rolledBackMigrationId', 'checksum', 'status', 'operations'],
          properties: {
            migrationId: { type: 'string', minLength: 1 },
            rolledBackMigrationId: { type: 'string', minLength: 1 },
            checksum: checksumSchema,
            status: { const: 'rolled_back' },
            operations: {
              type: 'array',
              items: { $ref: '#/components/schemas/SchemaMigrationForwardOperation' },
            },
          },
        },
      },
    },
  }
}
