import { describe, expect, it } from 'vitest'

import { createCursorPayload, decodeCursor, encodeCursor } from './cursor.js'

describe('cursor helpers', () => {
  it('round-trips encoded cursor payloads', () => {
    const payload = createCursorPayload({
      id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      sort: [{ field: 'created_at', direction: 'desc' }],
      values: {
        created_at: '2026-03-31T10:00:00.000Z',
      },
    })

    expect(decodeCursor(encodeCursor(payload))).toEqual(payload)
  })

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-a-valid-cursor')).toThrow('Invalid cursor')
  })
})
