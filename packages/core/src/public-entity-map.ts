/**
 * Mapping from snake_case public entity names (as they appear in REST paths
 * and SDK resource names) to the camelCase service keys on `CoreServices`.
 *
 * This is the single source of truth — both `@orbit-ai/api` (HTTP route
 * registration) and `@orbit-ai/sdk` (DirectTransport dispatch) must import
 * from here, not maintain their own copies. See
 * `public-entity-map.test.ts` for the drift-prevention test.
 */
export const PUBLIC_ENTITY_SERVICE_MAP: Readonly<Record<string, string>> = Object.freeze({
  sequence_steps: 'sequenceSteps',
  sequence_enrollments: 'sequenceEnrollments',
  sequence_events: 'sequenceEvents',
})

/**
 * The list of public entities whose REST path contains an underscore and
 * therefore needs a map entry to resolve to the camelCase service key.
 * Non-underscored entities (contacts, deals, companies, etc.) resolve 1:1
 * to the same name on `CoreServices`.
 *
 * Keep this list in sync with `PUBLIC_ENTITY_SERVICE_MAP`. The drift test in
 * `public-entity-map.test.ts` enforces that every entry in this array has
 * a corresponding value in the map.
 */
export const PUBLIC_ENTITIES_WITH_UNDERSCORE = [
  'sequence_steps',
  'sequence_enrollments',
  'sequence_events',
] as const

export type PublicEntityWithUnderscore = (typeof PUBLIC_ENTITIES_WITH_UNDERSCORE)[number]

/**
 * Resolve a public entity name (snake_case, as in REST paths) to the key on
 * `CoreServices` where that service is registered. Handles both underscored
 * and non-underscored entities.
 */
export function resolvePublicEntityServiceKey(entity: string): string {
  return PUBLIC_ENTITY_SERVICE_MAP[entity] ?? entity
}
