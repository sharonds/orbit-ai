import type { MiddlewareHandler } from 'hono'
import type { StorageAdapter } from '@orbit-ai/core'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

/**
 * Auth middleware: extracts Bearer token, hashes it, looks up the API key,
 * and sets the `orbit` context variable.
 */
export function authMiddleware(adapter: StorageAdapter): MiddlewareHandler {
  return async (c, next) => {
    const authorization = c.req.header('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'Missing or malformed Authorization header',
        hint: 'Provide a Bearer token in the Authorization header.',
      })
    }

    const token = authorization.slice(7)
    if (!token) {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'Missing or malformed Authorization header',
        hint: 'Provide a Bearer token in the Authorization header.',
      })
    }

    const hash = await hashToken(token)
    const key = await adapter.lookupApiKeyForAuth(hash)

    if (!key) {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'Invalid API key',
      })
    }

    if (key.revokedAt !== null) {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'API key has been revoked',
      })
    }

    if (key.expiresAt !== null && key.expiresAt.getTime() < Date.now()) {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'API key has expired',
      })
    }

    c.set('orbit', {
      orgId: key.organizationId,
      apiKeyId: key.id,
      scopes: key.scopes,
      requestId: c.get('requestId'),
    })

    await next()
  }
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
