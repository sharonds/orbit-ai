/**
 * Shared entity capability map.
 *
 * This is the SINGLE source of truth for which HTTP methods exist
 * per generic entity. Consumed by both:
 *  - routes/entities.ts (runtime route registration gating)
 *  - openapi/generator.ts (OpenAPI spec emission)
 *
 * If an entity is NOT listed here, it has dedicated route modules
 * (e.g. imports.ts, webhooks.ts) and should not be registered via
 * the generic entity loop.
 */
export const PUBLIC_ENTITY_CAPABILITIES = {
  contacts: { read: true, write: true, batch: true },
  companies: { read: true, write: true, batch: true },
  deals: { read: true, write: true, batch: true },
  pipelines: { read: true, write: true, batch: false },
  stages: { read: true, write: true, batch: false },
  users: { read: true, write: true, batch: false },
  // Wave 2 entities
  activities: { read: true, write: true, batch: true },
  tasks: { read: true, write: true, batch: true },
  notes: { read: true, write: true, batch: true },
  products: { read: true, write: true, batch: true },
  payments: { read: true, write: true, batch: true },
  contracts: { read: true, write: true, batch: true },
  sequences: { read: true, write: true, batch: true },
  sequence_steps: { read: true, write: true, batch: false },
  sequence_enrollments: { read: true, write: true, batch: false },
  sequence_events: { read: true, write: false, batch: false },
  tags: { read: true, write: true, batch: true },
  // imports: dedicated routes in imports.ts (not in generic entity loop)
  // webhooks: dedicated routes in webhooks.ts (not in generic entity loop)
} as const

export type PublicEntityName = keyof typeof PUBLIC_ENTITY_CAPABILITIES

export type EntityCapability = (typeof PUBLIC_ENTITY_CAPABILITIES)[PublicEntityName]
