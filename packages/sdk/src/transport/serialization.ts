/**
 * Bidirectional serialization between core's camelCase records and the
 * public SDK snake_case contract.  Mirrors packages/api/src/serialization.ts
 * — keep the two files in sync when adding entities or renaming fields.
 *
 * Direction A — output:  camelCase core record  →  snake_case SDK response
 * Direction B — input:   snake_case SDK body    →  camelCase core input
 */

export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

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

/** camelCase core field → target camelCase before camelToSnake. */
const ENTITY_RESPONSE_RENAMES: Record<string, Record<string, string>> = {
  deals: {
    title: 'name',
  },
  stages: {
    stageOrder: 'position',
  },
  notes: {
    content: 'body',
    createdByUserId: 'userId',
  },
  webhooks: {
    secretLastFour: 'signingSecretLastFour',
    secretCreatedAt: 'signingSecretCreatedAt',
  },
}

/** Core fields excluded from public responses. */
const ENTITY_STRIP_FIELDS: Record<string, Set<string>> = {
  deals: new Set(['wonAt', 'lostAt', 'lostReason', 'probability']),
  stages: new Set(['probability', 'color', 'isWon', 'isLost']),
  webhooks: new Set(['secretEncrypted']),
}

/** post-snakeToCamel camelCase field → core camelCase field. */
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
