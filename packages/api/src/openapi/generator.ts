/**
 * OpenAPI 3.1 spec generator for Orbit AI API.
 *
 * Short-term scope:
 * - reads generic entity capabilities from the shared entity capability map
 * - includes selected dedicated import/webhook routes so the public spec does
 *   not regress while the broader registry-driven rebuild (T10) is pending
 */

import { PUBLIC_ENTITY_CAPABILITIES } from '../routes/entity-capabilities.js'

export interface OpenApiInfo {
  title: string
  version: string
  description?: string
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
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: `Paginated list of ${entity}` },
            '401': { description: 'Unauthorized' },
            '429': { description: 'Rate limited' },
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
            '200': { description: `${singular} details` },
            '404': { description: 'Not found' },
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
            '201': { description: `${singular} created` },
            '400': { description: 'Validation error' },
            '401': { description: 'Unauthorized' },
            '409': { description: 'Conflict / idempotency conflict' },
            '429': { description: 'Rate limited' },
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
          '200': { description: `${singular} updated` },
          '404': { description: 'Not found' },
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
          '204': { description: `${singular} deleted` },
          '404': { description: 'Not found' },
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
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Paginated list of imports' },
        '401': { description: 'Unauthorized' },
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
        '201': { description: 'Import created' },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthorized' },
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
        '200': { description: 'Import details' },
        '404': { description: 'Not found' },
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
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Paginated list of webhooks' },
        '401': { description: 'Unauthorized' },
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
        '201': { description: 'Webhook created' },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthorized' },
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
        '200': { description: 'Webhook details' },
        '404': { description: 'Not found' },
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
        '200': { description: 'Webhook updated' },
        '404': { description: 'Not found' },
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
        '200': { description: 'Webhook deleted' },
        '404': { description: 'Not found' },
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
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Paginated list of webhook deliveries' },
        '404': { description: 'Not found' },
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
        '200': { description: 'Webhook redelivery triggered' },
        '404': { description: 'Not found' },
      },
    },
  }

  // Health + status endpoints
  paths['/health'] = {
    get: {
      summary: 'Health check',
      operationId: 'healthCheck',
      tags: ['System'],
      responses: { '200': { description: 'Service is healthy' } },
    },
  }

  paths['/v1/status'] = {
    get: {
      summary: 'Authenticated status',
      operationId: 'status',
      tags: ['System'],
      responses: { '200': { description: 'Authenticated status with org info' } },
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
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                retryable: { type: 'boolean' },
                request_id: { type: 'string' },
                doc_url: { type: 'string' },
              },
              required: ['code', 'message', 'retryable'],
            },
          },
        },
        Envelope: {
          type: 'object',
          properties: {
            data: {},
            meta: {
              type: 'object',
              properties: {
                request_id: { type: 'string' },
                version: { type: 'string' },
                cursor: { type: 'string', nullable: true },
                next_cursor: { type: 'string', nullable: true },
                has_more: { type: 'boolean' },
              },
            },
            links: {
              type: 'object',
              properties: {
                self: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }
}
