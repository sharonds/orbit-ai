import { ulid } from 'ulid'

import type { OrbitIdKind } from './prefixes.js'
import { ID_PREFIXES } from './prefixes.js'

export function generateId(kind: OrbitIdKind): string {
  return `${ID_PREFIXES[kind]}_${ulid()}`
}
