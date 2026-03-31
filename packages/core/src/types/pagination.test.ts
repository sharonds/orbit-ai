import { describe, expect, it } from 'vitest'

import { toWirePageMeta } from './pagination.js'

describe('toWirePageMeta', () => {
  it('maps internal page state to wire metadata', () => {
    expect(
      toWirePageMeta({
        requestId: 'req_123',
        version: '2026-03-31',
        page: {
          data: [],
          nextCursor: 'cursor_2',
          hasMore: true,
        },
      }),
    ).toEqual({
      request_id: 'req_123',
      cursor: null,
      next_cursor: 'cursor_2',
      has_more: true,
      version: '2026-03-31',
    })
  })
})
