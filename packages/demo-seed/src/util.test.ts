import { describe, it, expect } from 'vitest'
import { emailLocalPart } from './util.js'

describe('emailLocalPart', () => {
  it('strips the space in a two-word surname so "De Boer" yields "deboer"', () => {
    // Regression guard: if users.ts reverts to `${last.toLowerCase()}`, the
    // embedded space would produce an invalid email local-part. Keeping a
    // direct unit test here (not just a probabilistic /@/ check in users.test)
    // makes that regression fail on every run, not only when PRNG hits
    // a multi-word surname.
    expect(emailLocalPart('De Boer')).toBe('deboer')
  })

  it('strips the apostrophe in "O\'Brien"', () => {
    expect(emailLocalPart("O'Brien")).toBe('obrien')
  })

  it('strips the hyphen in "El-Amin"', () => {
    expect(emailLocalPart('El-Amin')).toBe('elamin')
  })

  it('leaves a simple ASCII surname like "Ng" untouched (lowercased)', () => {
    expect(emailLocalPart('Ng')).toBe('ng')
  })

  it('strips non-[a-z0-9] characters from accented names — current behavior drops the accent entirely', () => {
    // Document the current (lossy) behavior for accented characters. This is
    // acceptable for synthetic demo data: the local-part remains RFC-safe,
    // and collisions are avoided by the `+demo<i>` suffix in users.ts. If we
    // later switch to a transliterating strategy (e.g. "José" -> "jose"),
    // update this test accordingly.
    expect(emailLocalPart('José')).toBe('jos')
  })
})
