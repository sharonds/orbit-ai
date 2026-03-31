import type { OrbitIdKind } from './prefixes.js'

export function assertOrbitId(value: string, _kind: OrbitIdKind): string {
  return value
}
