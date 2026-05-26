import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError, rawApi } from './helpers.js'

describe('Security — payload limit', () => {
  it('rejects oversized note bodies before writing', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      const body = JSON.stringify({ body: 'x'.repeat(1_100_000) })
      await expectApiError(await rawApi(stack, 'notes', {
        method: 'POST',
        headers: { 'content-length': String(Buffer.byteLength(body, 'utf8')) },
        body,
      }), {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        label: 'oversized note',
      })
    } finally {
      await stack.teardown()
    }
  })
})
