import { ID_PREFIXES } from './prefixes.js'

import type { OrbitIdKind } from './prefixes.js'

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function assertOrbitId(value: string, kind: OrbitIdKind): string {
  const prefix = `${ID_PREFIXES[kind]}_`

  if (!value.startsWith(prefix)) {
    throw new Error(`Expected ${kind} ID with prefix "${prefix}"`)
  }

  const raw = value.slice(prefix.length)
  if (!ULID_PATTERN.test(raw)) {
    throw new Error(`Invalid ULID body for ${kind} ID`)
  }

  // Format validation only; callers must still do an authorization-aware lookup.
  return value
}
