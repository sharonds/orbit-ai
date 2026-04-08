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
          '204': { description: `${singular} deleted (no body)` },
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
      },
    },
  }
}
