import type { Hono } from 'hono'
import type { Context } from 'hono'
import type { CoreServices, InternalPaginatedResult } from '@orbit-ai/core'
import { OrbitError } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'
import { paginationParams } from '../utils/pagination.js'

function notImplemented(c: Context, operation: string) {
  return c.json(toError(c, 'INTERNAL_ERROR', `${operation} not implemented`), 501)
}

function assertPaginatedResult(result: unknown, operation: string): asserts result is InternalPaginatedResult<unknown> {
  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray((result as any).data) ||
    typeof (result as any).hasMore !== 'boolean'
  ) {
    throw new OrbitError({ code: 'INTERNAL_ERROR', message: `${operation} returned unexpected shape` })
  }
}

export function registerRelationshipRoutes(app: Hono, services: CoreServices) {
  // --- Contact relationships ---

  app.get('/v1/contacts/:id/timeline', requireScope('contacts:read'), async (c) => {
    const service = services.contacts as any
    if (typeof service.timeline !== 'function') return notImplemented(c, 'Contact timeline')
    const result = await service.timeline(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Contact timeline')
    return c.json(toEnvelope(c, result.data, result))
  })

  app.get('/v1/contacts/:id/deals', requireScope('contacts:read'), requireScope('deals:read'), async (c) => {
    const service = services.contacts as any
    if (typeof service.deals !== 'function') return notImplemented(c, 'Contact deals')
    const result = await service.deals(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Contact deals')
    return c.json(toEnvelope(c, result.data, result))
  })

  app.get('/v1/contacts/:id/activities', requireScope('contacts:read'), requireScope('activities:read'), async (c) => {
    const service = services.contacts as any
    if (typeof service.activities !== 'function') return notImplemented(c, 'Contact activities')
    const result = await service.activities(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Contact activities')
    return c.json(toEnvelope(c, result.data, result))
  })

  app.get('/v1/contacts/:id/tasks', requireScope('contacts:read'), requireScope('tasks:read'), async (c) => {
    const service = services.contacts as any
    if (typeof service.tasks !== 'function') return notImplemented(c, 'Contact tasks')
    const result = await service.tasks(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Contact tasks')
    return c.json(toEnvelope(c, result.data, result))
  })

  app.get('/v1/contacts/:id/tags', requireScope('contacts:read'), requireScope('tags:read'), async (c) => {
    const service = services.contacts as any
    if (typeof service.tags !== 'function') return notImplemented(c, 'Contact tags')
    const result = await service.tags(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Contact tags')
    return c.json(toEnvelope(c, result.data, result))
  })

  // --- Company relationships ---

  app.get('/v1/companies/:id/contacts', requireScope('companies:read'), requireScope('contacts:read'), async (c) => {
    const service = services.companies as any
    if (typeof service.contacts !== 'function') return notImplemented(c, 'Company contacts')
    const result = await service.contacts(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Company contacts')
    return c.json(toEnvelope(c, result.data, result))
  })

  app.get('/v1/companies/:id/deals', requireScope('companies:read'), requireScope('deals:read'), async (c) => {
    const service = services.companies as any
    if (typeof service.deals !== 'function') return notImplemented(c, 'Company deals')
    const result = await service.deals(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Company deals')
    return c.json(toEnvelope(c, result.data, result))
  })

  // --- Deal relationships ---

  app.get('/v1/deals/:id/timeline', requireScope('deals:read'), async (c) => {
    const service = services.deals as any
    if (typeof service.timeline !== 'function') return notImplemented(c, 'Deal timeline')
    const result = await service.timeline(c.get('orbit'), c.req.param('id'), paginationParams(c))
    assertPaginatedResult(result, 'Deal timeline')
    return c.json(toEnvelope(c, result.data, result))
  })
}
