import { describe, expect, it } from 'vitest'

import { ID_PREFIXES } from './prefixes.js'

describe('ID_PREFIXES invariants', () => {
  it('keeps every prefix unique', () => {
    const prefixes = Object.values(ID_PREFIXES)

    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  it('avoids one prefix being another full prefix token', () => {
    const prefixes = Object.values(ID_PREFIXES)

    for (const prefix of prefixes) {
      for (const other of prefixes) {
        if (prefix === other) {
          continue
        }

        expect(other.startsWith(`${prefix}_`)).toBe(false)
      }
    }
  })
})
