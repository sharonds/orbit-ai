import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import './context.js'

/**
 * Middleware that requires the authenticated context to have a specific scope.
 * Supports exact match, wildcard `*`, resource wildcard `resource:*`,
 * and `admin:*` for admin-prefixed scopes.
 */
export function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    const ctx = c.get('orbit')
    const scopes = ctx?.scopes ?? []

    if (hasScope(scopes, scope)) {
      await next()
      return
    }

    throw new OrbitError({
      code: 'AUTH_INSUFFICIENT_SCOPE',
      message: `Missing required scope: ${scope}`,
      hint: `The API key must include the "${scope}" scope.`,
    })
  }
}

function hasScope(scopes: string[], required: string): boolean {
  // Full wildcard
  if (scopes.includes('*')) return true

  // Exact match
  if (scopes.includes(required)) return true

  // Resource wildcard: e.g. "contacts:*" matches "contacts:read"
  const [resource] = required.split(':')
  if (resource && scopes.includes(`${resource}:*`)) return true

  // Admin wildcard: "admin:*" matches any "admin:..." scope
  if (required.startsWith('admin:') && scopes.includes('admin:*')) return true

  return false
}
