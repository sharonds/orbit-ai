import { describe, it } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { expectApiError, rawApi } from './helpers.js'

const BLOCKED_URLS = [
  'https://localhost:8080/hook',
  'https://127.0.0.1/hook',
  'https://169.254.169.254/latest/meta-data',
  'https://10.0.0.1/hook',
  'https://192.168.1.10/hook',
  'https://[::ffff:7f00:1]/hook',
]

describe('Security — webhook SSRF', () => {
  it('rejects private, loopback, and metadata webhook destinations', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    try {
      for (const url of BLOCKED_URLS) {
        await expectApiError(await rawApi(stack, 'webhooks', {
          method: 'POST',
          body: JSON.stringify({
            url,
            events: ['contact.created'],
          }),
        }), {
          status: 400,
          code: 'VALIDATION_FAILED',
          label: `blocked webhook ${url}`,
        })
      }
    } finally {
      await stack.teardown()
    }
  })
})
