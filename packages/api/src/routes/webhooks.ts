import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError, toWebhookRead, toWebhookDeliveryRead } from '../responses.js'

export function registerWebhookRoutes(app: Hono, services: CoreServices) {
  // GET /v1/webhooks — list
  app.get('/v1/webhooks', async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
    const cursor = c.req.query('cursor') ?? undefined
    const service = services.webhooks as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    const sanitized = result.data.map((r: Record<string, unknown>) => toWebhookRead(r))
    return c.json(toEnvelope(c, sanitized, result))
  })

  // POST /v1/webhooks — create with URL validation
  app.post('/v1/webhooks', async (c) => {
    const body = await c.req.json()

    // Validate HTTPS-only URL
    if (typeof body.url !== 'string' || !body.url.startsWith('https://')) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Webhook URL must use HTTPS', {
        field: 'url',
        hint: 'Only HTTPS URLs are accepted for webhook endpoints.',
      }), 400)
    }

    const service = services.webhooks as any
    const created = await service.create(c.get('orbit'), body)

    // One-time secret exposure: include the full signing_secret in the create response
    const read = toWebhookRead(created as Record<string, unknown>)
    const response: Record<string, unknown> = { ...read }
    if (created.signing_secret || created.signingSecret) {
      response.signing_secret = created.signing_secret ?? created.signingSecret
    }

    return c.json(toEnvelope(c, response), 201)
  })

  // GET /v1/webhooks/:id — read (sanitized)
  app.get('/v1/webhooks/:id', async (c) => {
    const service = services.webhooks as any
    const record = await service.get(c.get('orbit'), c.req.param('id'))
    if (!record) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Webhook not found'), 404)
    }
    return c.json(toEnvelope(c, toWebhookRead(record as Record<string, unknown>)))
  })

  // PATCH /v1/webhooks/:id — update with URL validation
  app.patch('/v1/webhooks/:id', async (c) => {
    const body = await c.req.json()

    // Validate HTTPS-only URL if provided
    if (body.url !== undefined) {
      if (typeof body.url !== 'string' || !body.url.startsWith('https://')) {
        return c.json(toError(c, 'VALIDATION_FAILED', 'Webhook URL must use HTTPS', {
          field: 'url',
          hint: 'Only HTTPS URLs are accepted for webhook endpoints.',
        }), 400)
      }
    }

    const service = services.webhooks as any
    const updated = await service.update(c.get('orbit'), c.req.param('id'), body)
    return c.json(toEnvelope(c, toWebhookRead(updated as Record<string, unknown>)))
  })

  // DELETE /v1/webhooks/:id
  app.delete('/v1/webhooks/:id', async (c) => {
    const service = services.webhooks as any
    await service.delete(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, { id: c.req.param('id'), deleted: true }))
  })

  // GET /v1/webhooks/:id/deliveries — list deliveries for a webhook
  app.get('/v1/webhooks/:id/deliveries', async (c) => {
    const deliveriesService = services.system.webhookDeliveries as any
    if (typeof deliveriesService.list !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Webhook deliveries not implemented'), 501)
    }
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
    const cursor = c.req.query('cursor') ?? undefined
    const result = await deliveriesService.list(c.get('orbit'), {
      limit,
      cursor,
      webhookId: c.req.param('id'),
    })
    const sanitized = result.data.map((r: Record<string, unknown>) => toWebhookDeliveryRead(r))
    return c.json(toEnvelope(c, sanitized, result))
  })

  // POST /v1/webhooks/:id/redeliver — redeliver a webhook
  app.post('/v1/webhooks/:id/redeliver', async (c) => {
    const service = services.webhooks as any
    if (typeof service.redeliver !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Webhook redelivery not implemented'), 501)
    }
    const result = await service.redeliver(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })
}
