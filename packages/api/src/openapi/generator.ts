/**
 * Minimal OpenAPI 3.1 spec generator for Orbit AI API (MVP).
 *
 * This is a static spec covering the base entity CRUD pattern.
 * A future version will introspect the Hono router to auto-register paths.
 */

import { BASE_ENTITIES } from './entities.js'

export interface OpenApiInfo {
  title: string
  version: string
  description?: string
}

export function generateOpenApiSpec(info: OpenApiInfo): Record<string, unknown> {
  const paths: Record<string, unknown> = {}

  for (const entity of BASE_ENTITIES) {
    const tag = entity.charAt(0).toUpperCase() + entity.slice(1)
    const singular = entity.replace(/s$/, '')

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

    paths[`/v1/${entity}/{id}`] = {
      get: {
        summary: `Get a ${singular}`,
        operationId: `get${tag}`,
        tags: [tag],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: `${singular} details` },
          '404': { description: 'Not found' },
        },
      },
      patch: {
        summary: `Update a ${singular}`,
        operationId: `update${tag}`,
        tags: [tag],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': { description: `${singular} updated` },
          '404': { description: 'Not found' },
        },
      },
      delete: {
        summary: `Delete a ${singular}`,
        operationId: `delete${tag}`,
        tags: [tag],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: `${singular} deleted` },
          '404': { description: 'Not found' },
        },
      },
    }
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
    servers: [{ url: '/v1', description: 'API v1' }],
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
                org_id: { type: 'string' },
                api_version: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }
}
