import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requireScope } from '../scopes.js'
import { toEnvelope, toError, sanitizeSchemaRead } from '../responses.js'

function notImplemented(c: any, operation: string) {
  return c.json(toError(c, 'INTERNAL_ERROR', `${operation} not implemented`), 501)
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
  app.patch('/v1/objects/:type/fields/:fieldName', requireScope('schema:write'), async (c) => {
    if (typeof schema.updateField !== 'function') {
      return notImplemented(c, 'Update custom field')
    }
    const body = await c.req.json()
    const result = await schema.updateField(
      c.get('orbit'),
      c.req.param('type'),
      c.req.param('fieldName'),
      body,
    )
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // DELETE /v1/objects/:type/fields/:fieldName — delete a custom field
  app.delete('/v1/objects/:type/fields/:fieldName', requireScope('schema:write'), async (c) => {
    if (typeof schema.deleteField !== 'function') {
      return notImplemented(c, 'Delete custom field')
    }
    await schema.deleteField(c.get('orbit'), c.req.param('type'), c.req.param('fieldName'))
    return c.json(toEnvelope(c, { deleted: true, field: c.req.param('fieldName') }))
  })

  // --- Schema migrations ---

  // POST /v1/schema/migrations/preview — preview a migration
  app.post('/v1/schema/migrations/preview', requireScope('schema:read'), async (c) => {
    if (typeof schema.preview !== 'function') {
      return notImplemented(c, 'Schema migration preview')
    }
    const body = await c.req.json()
    const result = await schema.preview(c.get('orbit'), body)
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // POST /v1/schema/migrations/apply — apply a migration (requires schema:apply scope)
  app.post('/v1/schema/migrations/apply', requireScope('schema:apply'), async (c) => {
    if (typeof schema.apply !== 'function') {
      return notImplemented(c, 'Schema migration apply')
    }
    const body = await c.req.json()
    const result = await schema.apply(c.get('orbit'), body)
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })

  // POST /v1/schema/migrations/:id/rollback — rollback a migration (requires schema:apply scope)
  app.post('/v1/schema/migrations/:id/rollback', requireScope('schema:apply'), async (c) => {
    if (typeof schema.rollback !== 'function') {
      return notImplemented(c, 'Schema migration rollback')
    }
    const result = await schema.rollback(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, sanitizeSchemaRead(result)))
  })
}
