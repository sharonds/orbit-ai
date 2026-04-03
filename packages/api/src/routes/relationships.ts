import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'

function notImplemented(c: any, operation: string) {
  return c.json(toError(c, 'INTERNAL_ERROR', `${operation} not implemented`), 501)
}

export function registerRelationshipRoutes(app: Hono, services: CoreServices) {
  // --- Contact relationships ---

  // GET /v1/contacts/:id/timeline
  app.get('/v1/contacts/:id/timeline', async (c) => {
    const service = services.contacts as any
    if (typeof service.timeline !== 'function') {
      return notImplemented(c, 'Contact timeline')
    }
    const result = await service.timeline(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/contacts/:id/deals
  app.get('/v1/contacts/:id/deals', async (c) => {
    const service = services.contacts as any
    if (typeof service.deals !== 'function') {
      return notImplemented(c, 'Contact deals')
    }
    const result = await service.deals(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/contacts/:id/activities
  app.get('/v1/contacts/:id/activities', async (c) => {
    const service = services.contacts as any
    if (typeof service.activities !== 'function') {
      return notImplemented(c, 'Contact activities')
    }
    const result = await service.activities(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/contacts/:id/tasks
  app.get('/v1/contacts/:id/tasks', async (c) => {
    const service = services.contacts as any
    if (typeof service.tasks !== 'function') {
      return notImplemented(c, 'Contact tasks')
    }
    const result = await service.tasks(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/contacts/:id/tags
  app.get('/v1/contacts/:id/tags', async (c) => {
    const service = services.contacts as any
    if (typeof service.tags !== 'function') {
      return notImplemented(c, 'Contact tags')
    }
    const result = await service.tags(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // --- Company relationships ---

  // GET /v1/companies/:id/contacts
  app.get('/v1/companies/:id/contacts', async (c) => {
    const service = services.companies as any
    if (typeof service.contacts !== 'function') {
      return notImplemented(c, 'Company contacts')
    }
    const result = await service.contacts(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/companies/:id/deals
  app.get('/v1/companies/:id/deals', async (c) => {
    const service = services.companies as any
    if (typeof service.deals !== 'function') {
      return notImplemented(c, 'Company deals')
    }
    const result = await service.deals(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // --- Deal relationships ---

  // GET /v1/deals/:id/timeline
  app.get('/v1/deals/:id/timeline', async (c) => {
    const service = services.deals as any
    if (typeof service.timeline !== 'function') {
      return notImplemented(c, 'Deal timeline')
    }
    const result = await service.timeline(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })
}
