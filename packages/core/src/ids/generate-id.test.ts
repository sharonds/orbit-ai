import { describe, expect, it } from 'vitest'

import { generateId } from './generate-id.js'

describe('generateId', () => {
  it('creates prefixed ulid ids', () => {
    const id = generateId('contact')
    expect(id.startsWith('contact_')).toBe(true)
    expect(id).toHaveLength('contact_'.length + 26)
  })

  it('creates unique ids across successive calls', () => {
    expect(generateId('contact')).not.toBe(generateId('contact'))
  })
})
