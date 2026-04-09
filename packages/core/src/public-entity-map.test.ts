import { describe, it, expect } from 'vitest'
import {
  PUBLIC_ENTITY_SERVICE_MAP,
  resolvePublicEntityServiceKey,
  PUBLIC_ENTITIES_WITH_UNDERSCORE,
} from './public-entity-map.js'
import type { CoreServices } from './index.js'

describe('PUBLIC_ENTITY_SERVICE_MAP', () => {
  it('every snake_case public entity in the allowlist array has a map entry', () => {
    for (const entity of PUBLIC_ENTITIES_WITH_UNDERSCORE) {
      expect(PUBLIC_ENTITY_SERVICE_MAP).toHaveProperty(entity)
      const resolved = PUBLIC_ENTITY_SERVICE_MAP[entity]
      expect(typeof resolved).toBe('string')
      expect(resolved.length).toBeGreaterThan(0)
    }
  })

  it('every map entry is also in the allowlist array (bidirectional drift check)', () => {
    // Without this, someone could add a new key to the map without adding it
    // to PUBLIC_ENTITIES_WITH_UNDERSCORE, and the drift test above would miss
    // it because it only iterates the array.
    expect(Object.keys(PUBLIC_ENTITY_SERVICE_MAP).length).toBe(PUBLIC_ENTITIES_WITH_UNDERSCORE.length)
    for (const key of Object.keys(PUBLIC_ENTITY_SERVICE_MAP)) {
      expect(PUBLIC_ENTITIES_WITH_UNDERSCORE).toContain(key)
    }
  })

  it('resolvePublicEntityServiceKey returns the entity name itself for non-underscored entities', () => {
    expect(resolvePublicEntityServiceKey('contacts')).toBe('contacts')
    expect(resolvePublicEntityServiceKey('deals')).toBe('deals')
  })

  it('resolvePublicEntityServiceKey returns the camelCase service key for underscored entities', () => {
    expect(resolvePublicEntityServiceKey('sequence_steps')).toBe('sequenceSteps')
    expect(resolvePublicEntityServiceKey('sequence_enrollments')).toBe('sequenceEnrollments')
    expect(resolvePublicEntityServiceKey('sequence_events')).toBe('sequenceEvents')
  })

  it('every mapped service key is a declared key on the CoreServices type (compile-time drift check)', () => {
    // Compile-time assertion: if PUBLIC_ENTITY_SERVICE_MAP points at a value
    // that is NOT a valid `keyof CoreServices`, THIS FILE FAILS TO COMPILE.
    // The runtime assertion is trivially true — the real value is the
    // TypeScript type-check on the assignment itself.
    const _typeCheck: Record<string, keyof CoreServices> = PUBLIC_ENTITY_SERVICE_MAP
    expect(_typeCheck).toBe(PUBLIC_ENTITY_SERVICE_MAP)
  })
})
