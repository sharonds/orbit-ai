import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'

export function registerContextRoutes(app: Hono, services: CoreServices) {
  app.get('/v1/context/:contactId', requireScope('contacts:read'), async (c) => {
    const contactId = c.req.param('contactId')
    const result = await services.contactContext.getContactContext(
      c.get('orbit'),
      { contactId },
    )
    if (!result) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Contact not found'), 404)
    }
    return c.json(toEnvelope(c, result))
  })
}
