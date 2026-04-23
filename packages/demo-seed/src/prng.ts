import seedrandom from 'seedrandom'

export interface Prng {
  float(): number
  intBetween(minInclusive: number, maxInclusive: number): number
  pickOne<T>(pool: readonly T[]): T
  pickMany<T>(pool: readonly T[], count: number): T[]
  boolWithProbability(probability: number): boolean
}

export function createPrng(seed: string): Prng {
  const rng = seedrandom(seed)
  const float = (): number => rng()
  const intBetween = (minInclusive: number, maxInclusive: number): number => {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new TypeError('intBetween: bounds must be integers')
    }
    if (maxInclusive < minInclusive) throw new RangeError('intBetween: max < min')
    return minInclusive + Math.floor(float() * (maxInclusive - minInclusive + 1))
  }
  const pickOne = <T>(pool: readonly T[]): T => {
    if (pool.length === 0) throw new RangeError('pickOne: empty pool')
    return pool[intBetween(0, pool.length - 1)]!
  }
  const pickMany = <T>(pool: readonly T[], count: number): T[] => {
    if (!Number.isInteger(count)) throw new TypeError('pickMany: count must be an integer')
    if (count < 0) throw new TypeError('pickMany: count must be >= 0')
    if (count > pool.length) throw new RangeError('pickMany: count > pool size')
    const remaining = [...pool]
    const out: T[] = []
    for (let i = 0; i < count; i += 1) {
      const idx = intBetween(0, remaining.length - 1)
      out.push(remaining.splice(idx, 1)[0]!)
    }
    return out
  }
  const boolWithProbability = (probability: number): boolean => {
    if (Number.isNaN(probability)) throw new RangeError('boolWithProbability: p is NaN')
    if (probability < 0 || probability > 1) throw new RangeError('boolWithProbability: p ∉ [0,1]')
    return float() < probability
  }
  return { float, intBetween, pickOne, pickMany, boolWithProbability }
}
