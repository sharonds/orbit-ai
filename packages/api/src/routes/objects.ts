import type { Hono } from 'hono'
import {
  destructiveConfirmationSchema,
  schemaMigrationApplyInputSchema,
  schemaMigrationDeleteFieldInputSchema,
  schemaMigrationPreviewInputSchema,
  schemaMigrationRollbackInputSchema,
  schemaMigrationUpdateFieldRequestInputSchema,
} from '@orbit-ai/core'
import type { CoreServices } from '@orbit-ai/core'
import { z } from 'zod'
import { requireScope } from '../scopes.js'
import { toEnvelope, toError, sanitizeSchemaRead } from '../responses.js'

const DeleteFieldRequestBodySchema = z.object({
  confirmation: destructiveConfirmationSchema.optional(),
}).strict()

function notImplemented(c: any, operation: string) {
  return c.json(toError(c, 'INTERNAL_ERROR', `${operation} not implemented`), 501)
}

function hasScope(ctx: { scopes?: string[] } | undefined, scope: string): boolean {
  const scopes = ctx?.scopes ?? []
  if (scopes.includes('*')) return true
  if (scopes.includes(scope)) return true
  const [resource] = scope.split(':')
  return resource !== undefined && scopes.includes(`${resource}:*`)
}

async function readJsonBody(c: any, fallback: Record<string, unknown> = {}): Promise<unknown> {
  const text = await c.req.text()
  return text.trim().length === 0 ? fallback : JSON.parse(text)
}

export function registerObjectRoutes(app: Hono, services: CoreServices) {
  const schema = services.schema as any

  // GET /v1/objects — list object types
  app.get('/v1/objects', requireScope('schema:read'), async (c) => {
    if (typeof schema.listObjects !== 'function') {
      return notImplemented(c, 'List object types')
    }
    const result = await schema.listObjects(c.get('orbit'))
    return c.json(toEnvelope(c, Array.isArray(result) ? result.map(sanitizeSchemaRead) : sanitizeSchemaRead(result)))
  })

  // GET /v1/objects/:type — get object type schema
  app.get('/v1/objects/:type', requireScope('schema:read'), async (c) => {
    if (typeof schema.getObject !== 'function') {
      return notImplemented(c, 'Get object type')
    }
    const result = await schema.getObject(c.get('orbit'), c.req.param('type'))
    if (!result) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', `Object type '${c.req.param('type')}' not found`), 404)
    }
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // POST /v1/objects/:type/fields — add a custom field
  app.post('/v1/objects/:type/fields', requireScope('schema:write'), async (c) => {
    if (typeof schema.addField !== 'function') {
      return notImplemented(c, 'Add custom field')
    }
    const body = await c.req.json()
    const result = await schema.addField(c.get('orbit'), c.req.param('type'), body)
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)), 201)
  })

  // PATCH /v1/objects/:type/fields/:fieldName — update a custom field
  app.patch('/v1/objects/:type/fields/:fieldName', async (c) => {
    if (typeof schema.updateField !== 'function') {
      return notImplemented(c, 'Update custom field')
    }
    if (typeof schema.preview !== 'function') {
      return notImplemented(c, 'Schema migration preview')
    }
    const body = schemaMigrationUpdateFieldRequestInputSchema.parse(await readJsonBody(c))
    const { confirmation: _confirmation, ...patch } = body
    const authContext = c.get('orbit')
    if (!hasScope(authContext, 'schema:write') && !hasScope(authContext, 'schema:apply')) {
      return c.json(toError(c, 'AUTH_INSUFFICIENT_SCOPE', 'API key lacks required scope: schema:write or schema:apply'), 403)
    }
    const preview = await schema.preview(c.get('orbit'), {
      operations: [{
        type: 'custom_field.update',
        entityType: c.req.param('type'),
        fieldName: c.req.param('fieldName'),
        patch,
      }],
    })
    if (preview?.destructive === true && !hasScope(authContext, 'schema:apply')) {
      return c.json(toError(c, 'AUTH_INSUFFICIENT_SCOPE', 'API key lacks required scope: schema:apply'), 403)
    }
    if (preview?.destructive !== true && !hasScope(authContext, 'schema:write')) {
      return c.json(toError(c, 'AUTH_INSUFFICIENT_SCOPE', 'API key lacks required scope: schema:write'), 403)
    }
    const result = await schema.updateField(
      c.get('orbit'),
      c.req.param('type'),
      c.req.param('fieldName'),
      body,
    )
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // DELETE /v1/objects/:type/fields/:fieldName — delete a custom field
  app.delete('/v1/objects/:type/fields/:fieldName', requireScope('schema:apply'), async (c) => {
    if (typeof schema.deleteField !== 'function') {
      return notImplemented(c, 'Delete custom field')
    }
    const body = DeleteFieldRequestBodySchema.parse(await readJsonBody(c))
    schemaMigrationDeleteFieldInputSchema.parse({
      entityType: c.req.param('type'),
      fieldName: c.req.param('fieldName'),
      ...body,
    })
    await schema.deleteField(c.get('orbit'), c.req.param('type'), c.req.param('fieldName'), body)
    return c.json(toEnvelope(c, { deleted: true, field: c.req.param('fieldName') }))
  })

  // --- Schema migrations ---

  // POST /v1/schema/migrations/preview — preview a migration
  app.post('/v1/schema/migrations/preview', requireScope('schema:read'), async (c) => {
    if (typeof schema.preview !== 'function') {
      return notImplemented(c, 'Schema migration preview')
    }
    const input = schemaMigrationPreviewInputSchema.parse(await readJsonBody(c))
    const result = await schema.preview(c.get('orbit'), input)
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // POST /v1/schema/migrations/apply — apply a migration (requires schema:apply scope)
  app.post('/v1/schema/migrations/apply', requireScope('schema:apply'), async (c) => {
    if (typeof schema.apply !== 'function') {
      return notImplemented(c, 'Schema migration apply')
    }
    const input = schemaMigrationApplyInputSchema.parse(await readJsonBody(c))
    const result = await schema.apply(c.get('orbit'), input)
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // POST /v1/schema/migrations/:id/rollback — rollback a migration (requires schema:apply scope)
  app.post('/v1/schema/migrations/:id/rollback', requireScope('schema:apply'), async (c) => {
    if (typeof schema.rollback !== 'function') {
      return notImplemented(c, 'Schema migration rollback')
    }
    const body = await readJsonBody(c)
    const input = schemaMigrationRollbackInputSchema.parse({
      ...(body as Record<string, unknown>),
      migrationId: c.req.param('id'),
    })
    const result = await schema.rollback(c.get('orbit'), input)
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })
}
