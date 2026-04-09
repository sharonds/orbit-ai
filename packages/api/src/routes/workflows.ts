import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'

function notImplemented(c: any, operation: string) {
  return c.json(toError(c, 'INTERNAL_ERROR', `${operation} not implemented`), 501)
}

export function registerWorkflowRoutes(app: Hono, services: CoreServices) {
  // --- Deal workflows ---

  // POST /v1/deals/:id/move — move deal to a different stage
  app.post('/v1/deals/:id/move', requireScope('deals:write'), async (c) => {
    const service = services.deals as any
    if (typeof service.move !== 'function') {
      return notImplemented(c, 'Deal move')
    }
    const body = await c.req.json()
    const result = await service.move(c.get('orbit'), c.req.param('id'), body)
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/deals/pipeline — get deals grouped by pipeline stage
  app.get('/v1/deals/pipeline', requireScope('deals:read'), async (c) => {
    const service = services.deals as any
    if (typeof service.pipeline !== 'function') {
      return notImplemented(c, 'Deal pipeline view')
    }
    const result = await service.pipeline(c.get('orbit'))
    return c.json(toEnvelope(c, result))
  })

  // GET /v1/deals/stats — get deal statistics
  app.get('/v1/deals/stats', requireScope('deals:read'), async (c) => {
    const service = services.deals as any
    if (typeof service.stats !== 'function') {
      return notImplemented(c, 'Deal stats')
    }
    const result = await service.stats(c.get('orbit'))
    return c.json(toEnvelope(c, result))
  })

  // --- Sequence workflows ---

  // POST /v1/sequences/:id/enroll — enroll a contact in a sequence
  app.post('/v1/sequences/:id/enroll', requireScope('sequences:write'), async (c) => {
    const service = services.sequences as any
    if (typeof service.enroll !== 'function') {
      return notImplemented(c, 'Sequence enrollment')
    }
    const body = await c.req.json()
    const result = await service.enroll(c.get('orbit'), c.req.param('id'), body)
    return c.json(toEnvelope(c, result), 201)
  })

  // POST /v1/sequence_enrollments/:id/unenroll — unenroll from a sequence
  app.post('/v1/sequence_enrollments/:id/unenroll', requireScope('sequence_enrollments:write'), async (c) => {
    const service = services.sequenceEnrollments as any
    if (typeof service.unenroll !== 'function') {
      return notImplemented(c, 'Sequence unenrollment')
    }
    const result = await service.unenroll(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })

  // --- Tag workflows ---

  // POST /v1/tags/:id/attach — attach tag to an entity
  app.post('/v1/tags/:id/attach', requireScope('tags:write'), async (c) => {
    const service = services.tags as any
    if (typeof service.attach !== 'function') {
      return notImplemented(c, 'Tag attach')
    }
    const body = await c.req.json()
    const result = await service.attach(c.get('orbit'), c.req.param('id'), body)
    return c.json(toEnvelope(c, result))
  })

  // POST /v1/tags/:id/detach — detach tag from an entity
  app.post('/v1/tags/:id/detach', requireScope('tags:write'), async (c) => {
    const service = services.tags as any
    if (typeof service.detach !== 'function') {
      return notImplemented(c, 'Tag detach')
    }
    const body = await c.req.json()
    const result = await service.detach(c.get('orbit'), c.req.param('id'), body)
    return c.json(toEnvelope(c, result))
  })

  // --- Activity workflows ---

  // POST /v1/activities/log — log an activity
  app.post('/v1/activities/log', requireScope('activities:write'), async (c) => {
    const service = services.activities as any
    if (typeof service.log !== 'function') {
      // Fall back to create if log doesn't exist
      if (typeof service.create === 'function') {
        const body = await c.req.json()
        const result = await service.create(c.get('orbit'), body)
        return c.json(toEnvelope(c, result), 201)
      }
      return notImplemented(c, 'Activity log')
    }
    const body = await c.req.json()
    const result = await service.log(c.get('orbit'), body)
    return c.json(toEnvelope(c, result), 201)
  })
}
