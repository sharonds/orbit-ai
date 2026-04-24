import { describe, it, expect } from 'vitest'
import { getOrbitVersion, getOrbitVersionFrom } from './version.js'

describe('getOrbitVersion', () => {
  it('returns a valid semver or semver-pre string', () => {
    const v = getOrbitVersion()
    expect(v).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)
  })
})

describe('getOrbitVersionFrom', () => {
  it('throws a reinstall-hint error when the package.json path does not exist', () => {
    expect(() => getOrbitVersionFrom('/nonexistent/package.json')).toThrow(
      /installation may be corrupt/,
    )
  })
})
