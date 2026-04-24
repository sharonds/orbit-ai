import { describe, it, expect } from 'vitest'
import { getOrbitVersion } from './version.js'

describe('getOrbitVersion', () => {
  it('returns a valid semver or semver-pre string', () => {
    const v = getOrbitVersion()
    expect(v).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)
  })
})
