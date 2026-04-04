/**
 * Entity names used by the OpenAPI generator.
 * Matches the public API route surface (PUBLIC_ENTITY_CAPABILITIES + dedicated routes).
 */
export const BASE_ENTITIES = [
  'contacts',
  'companies',
  'deals',
  'pipelines',
  'stages',
  'users',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  'sequence_events',
  'tags',
  'imports',
  'webhooks',
] as const

export type BaseEntityName = (typeof BASE_ENTITIES)[number]
