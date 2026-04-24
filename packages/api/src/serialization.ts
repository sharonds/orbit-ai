/**
 * Bidirectional serialization between core's camelCase records and the
 * public API's snake_case contract.
 *
 * Direction A — response: camelCase core record  →  snake_case API response
 * Direction B — request:  snake_case API body    →  camelCase core input
 *
 * Semantic renames (field names that differ beyond casing) are declared in
 * ENTITY_RESPONSE_RENAMES and ENTITY_INPUT_RENAMES below.
 */

/** "organizationId" → "organization_id" */
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/** "organization_id" → "organizationId" */
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** Singular `object` discriminator for each public entity path. */
const ENTITY_OBJECT_TYPES: Record<string, string> = {
  contacts: 'contact',
  companies: 'company',
  deals: 'deal',
  pipelines: 'pipeline',
  stages: 'stage',
  activities: 'activity',
  tasks: 'task',
  notes: 'note',
  products: 'product',
  payments: 'payment',
  contracts: 'contract',
  sequences: 'sequence',
  sequence_steps: 'sequence_step',
  sequence_enrollments: 'sequence_enrollment',
  sequence_events: 'sequence_event',
  tags: 'tag',
  users: 'user',
  imports: 'import',
  entity_tags: 'entity_tag',
  webhooks: 'webhook',
}

/**
 * Semantic renames applied during response serialization.
 * Key:   camelCase core field name.
 * Value: target camelCase name used before camelToSnake conversion.
 *
 * Only entries where the public name differs from camelToSnake(coreField).
 */
const ENTITY_RESPONSE_RENAMES: Record<string, Record<string, string>> = {
  deals: {
    title: 'name',
  },
  stages: {
    stageOrder: 'position',
  },
  notes: {
    content: 'body',
    createdByUserId: 'userId', // camelToSnake → "user_id"
  },
  webhooks: {
    secretLastFour: 'signingSecretLastFour',    // → "signing_secret_last_four"
    secretCreatedAt: 'signingSecretCreatedAt',  // → "signing_secret_created_at"
  },
}

/**
 * Core fields excluded from public responses.
 * Key:   camelCase core field name.
 */
const ENTITY_STRIP_FIELDS: Record<string, Set<string>> = {
  deals: new Set(['wonAt', 'lostAt', 'lostReason', 'probability']),
  stages: new Set(['probability', 'color', 'isWon', 'isLost']),
  webhooks: new Set(['secretEncrypted']),
}

/**
 * Semantic renames applied during request deserialization.
 * Key:   camelCase form of the public snake_case field (after snakeToCamel).
 * Value: camelCase core field name.
 *
 * Only entries where the public name differs from the core field.
 */
const ENTITY_INPUT_RENAMES: Record<string, Record<string, string>> = {
  deals: {
    name: 'title',
  },
  stages: {
    position: 'stageOrder',
  },
  notes: {
    body: 'content',
    userId: 'createdByUserId',
  },
}

/**
 * Convert a core camelCase record to a snake_case public API record.
 *
 * Steps:
 *   1. Inject the `object` discriminator.
 *   2. Skip underscore-prefixed internal fields and entity-specific strip list.
 *   3. Apply entity-specific semantic renames (stays camelCase after rename).
 *   4. Convert the resulting key with camelToSnake.
 *   5. Serialize Date values to ISO strings.
 */
export function serializeEntityRecord(
  entity: string,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const renames = ENTITY_RESPONSE_RENAMES[entity] ?? {}
  const strip = ENTITY_STRIP_FIELDS[entity] ?? new Set<string>()
  const out: Record<string, unknown> = {}

  const objectType = ENTITY_OBJECT_TYPES[entity]
  if (objectType !== undefined) {
    out.object = objectType
  }

  for (const [k, v] of Object.entries(record)) {
    if (k.startsWith('_') || strip.has(k)) continue
    const renamedKey = renames[k] ?? k
    const publicKey = camelToSnake(renamedKey)
    out[publicKey] = v instanceof Date ? v.toISOString() : v
  }

  return out
}

/**
 * Convert a snake_case public API request body to a camelCase core input.
 *
 * Steps:
 *   1. Convert each key with snakeToCamel.
 *   2. Apply entity-specific semantic renames (camelCase → core camelCase).
 */
export function deserializeEntityInput(
  entity: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const renames = ENTITY_INPUT_RENAMES[entity] ?? {}
  const out: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(body)) {
    const camelKey = snakeToCamel(k)
    const coreKey = renames[camelKey] ?? camelKey
    out[coreKey] = v
  }

  return out
}
