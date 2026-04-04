import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError, toWebhookRead, toWebhookDeliveryRead } from '../responses.js'
import { requireScope } from '../scopes.js'

/**
 * Deny-list of hostnames and IP patterns that must not be used as webhook targets.
 *
 * NOTE: This is a first-layer defense. For production, webhook delivery workers
 * should also validate the resolved IP address after DNS lookup to guard against
 * DNS rebinding, decimal/hex/octal IP encodings, and IPv4-mapped IPv6 addresses.
 */
/** IPv4 dotted-decimal deny patterns for private/loopback/link-local/metadata ranges. */
const IPV4_DENY_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
]

/** Hostname deny patterns (DNS names and IPv6 literals). */
const HOSTNAME_DENY_PATTERNS = [
  /^localhost$/i,
  /^::1$/,
  /^0:0:0:0:0:0:0:1$/,
  /^fe80:/i,   // link-local
  /^fc00:/i,   // unique-local (fd00: is the commonly used half)
  /^fd[0-9a-f]{2}:/i,
  /^metadata\.google\.internal$/i,
]

/**
 * Parse an IPv4-mapped IPv6 hostname (e.g. `::ffff:7f00:1`) back to dotted-decimal.
 * Node.js URL parser normalizes `::ffff:127.0.0.1` to hex form `::ffff:7f00:1`,
 * so regex matching against dotted notation would miss these.
 */
function ipv4MappedToIPv4(hostname: string): string | null {
  const match = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!match) return null
  const hi = parseInt(match[1]!, 16)
  const lo = parseInt(match[2]!, 16)
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

function isPrivateIPv4(ip: string): boolean {
  return IPV4_DENY_PATTERNS.some((p) => p.test(ip))
}

function validateWebhookUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'Invalid URL'
  }
  if (parsed.protocol !== 'https:') {
    return 'Webhook URL must use HTTPS'
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')

  // Check hostname deny patterns (DNS names, IPv6 literals)
  if (HOSTNAME_DENY_PATTERNS.some((p) => p.test(hostname))) {
    return 'Webhook URL must not point to private or loopback addresses'
  }

  // Check IPv4 dotted-decimal
  if (isPrivateIPv4(hostname)) {
    return 'Webhook URL must not point to private or loopback addresses'
  }

  // Check IPv4-mapped IPv6 (::ffff:hex:hex → convert to dotted-decimal and re-check)
  const mappedIPv4 = ipv4MappedToIPv4(hostname)
  if (mappedIPv4 && isPrivateIPv4(mappedIPv4)) {
    return 'Webhook URL must not point to private or loopback addresses'
  }

  return null
}

export function registerWebhookRoutes(app: Hono, services: CoreServices) {
  // GET /v1/webhooks — list
  app.get('/v1/webhooks', requireScope('webhooks:read'), async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
    const cursor = c.req.query('cursor') ?? undefined
    const service = services.webhooks as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    const sanitized = result.data.map((r: Record<string, unknown>) => toWebhookRead(r))
    return c.json(toEnvelope(c, sanitized, result))
  })

  // POST /v1/webhooks — create with URL validation
  app.post('/v1/webhooks', requireScope('webhooks:write'), async (c) => {
    const body = await c.req.json()

    // Validate webhook URL (HTTPS-only + SSRF protection)
    const urlError = typeof body.url === 'string' ? validateWebhookUrl(body.url) : 'URL is required'
    if (urlError) {
      return c.json(toError(c, 'VALIDATION_FAILED', urlError, {
        field: 'url',
        hint: 'Only HTTPS URLs pointing to public addresses are accepted.',
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
  app.get('/v1/webhooks/:id', requireScope('webhooks:read'), async (c) => {
    const service = services.webhooks as any
    const record = await service.get(c.get('orbit'), c.req.param('id'))
    if (!record) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Webhook not found'), 404)
    }
    return c.json(toEnvelope(c, toWebhookRead(record as Record<string, unknown>)))
  })

  // PATCH /v1/webhooks/:id — update with URL validation
  app.patch('/v1/webhooks/:id', requireScope('webhooks:write'), async (c) => {
    const body = await c.req.json()

    // Validate webhook URL if provided (HTTPS-only + SSRF protection)
    if (body.url !== undefined) {
      const urlError = typeof body.url === 'string' ? validateWebhookUrl(body.url) : 'URL must be a string'
      if (urlError) {
        return c.json(toError(c, 'VALIDATION_FAILED', urlError, {
          field: 'url',
          hint: 'Only HTTPS URLs pointing to public addresses are accepted.',
        }), 400)
      }
    }

    const service = services.webhooks as any
    const updated = await service.update(c.get('orbit'), c.req.param('id'), body)
    return c.json(toEnvelope(c, toWebhookRead(updated as Record<string, unknown>)))
  })

  // DELETE /v1/webhooks/:id
  app.delete('/v1/webhooks/:id', requireScope('webhooks:write'), async (c) => {
    const service = services.webhooks as any
    await service.delete(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, { id: c.req.param('id'), deleted: true }))
  })

  // GET /v1/webhooks/:id/deliveries — list deliveries for a webhook
  app.get('/v1/webhooks/:id/deliveries', requireScope('webhooks:read'), async (c) => {
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
  app.post('/v1/webhooks/:id/redeliver', requireScope('webhooks:write'), async (c) => {
    const service = services.webhooks as any
    if (typeof service.redeliver !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Webhook redelivery not implemented'), 501)
    }
    const result = await service.redeliver(c.get('orbit'), c.req.param('id'))
    return c.json(toEnvelope(c, result))
  })
}
