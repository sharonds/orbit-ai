/**
 * Base entity names used by the OpenAPI generator.
 * Mirrors the 12 base entities from @orbit-ai/core.
 */
export const BASE_ENTITIES = [
  'contacts',
  'companies',
  'deals',
  'pipeline_stages',
  'activities',
  'products',
  'payments',
  'contracts',
  'channels',
  'sequences',
  'tags',
  'notes',
] as const

export type BaseEntityName = (typeof BASE_ENTITIES)[number]
