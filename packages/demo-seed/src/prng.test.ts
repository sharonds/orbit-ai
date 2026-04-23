import { describe, it, expect } from 'vitest'
import { createPrng } from './prng.js'

describe('createPrng', () => {
  it('produces identical sequences for the same seed', () => {
    const a = createPrng('test-seed')
    const b = createPrng('test-seed')
    const seqA = Array.from({ length: 10 }, () => a.float())
    const seqB = Array.from({ length: 10 }, () => b.float())
    expect(seqA).toEqual(seqB)
  })

  it('pickOne returns an element from the provided array', () => {
    const prng = createPrng('seed-1')
    const pool = ['a', 'b', 'c', 'd']
    expect(pool).toContain(prng.pickOne(pool))
  })

  it('intBetween returns a value within the inclusive range', () => {
    const prng = createPrng('seed-2')
    for (let i = 0; i < 100; i += 1) {
      const n = prng.intBetween(5, 10)
      expect(n).toBeGreaterThanOrEqual(5)
      expect(n).toBeLessThanOrEqual(10)
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = createPrng('seed-a')
    const b = createPrng('seed-b')
    expect(a.float()).not.toEqual(b.float())
  })
})
