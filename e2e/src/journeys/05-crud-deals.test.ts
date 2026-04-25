import { describe, expect, it } from 'vitest'
import { OrbitApiError } from '@orbit-ai/sdk'
import { buildStack } from '../harness/build-stack.js'
import { startApiServer, type StartedApiServer } from '../harness/api-server.js'
import { expectMcpError } from '../harness/mcp-envelope.js'
import { runCli } from '../harness/run-cli.js'
import { spawnMcp } from '../harness/run-mcp.js'
import { runCrudMatrix } from './_crud-matrix.js'

const API_VERSION = '2026-04-01'

describe('Journey 5 — CRUD deals (5 surfaces)', () => {
  it('create/list/get/update/delete deals across HTTP, direct, API, CLI, MCP', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    try {
      await runCrudMatrix(stack, {
        entity: 'deals',
        create: { name: 'Journey5 Deal', value: 1000 },
        update: { name: 'Updated Deal' },
        updateField: 'name',
        updateValue: 'Updated Deal',
        assertField: 'name',
        expectedIdPrefix: 'deal_',
      })
    } finally {
      await stack.teardown()
    }
  })

  it('returns VALIDATION_FAILED for scientific-notation deal values on every surface', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    let server: StartedApiServer | undefined
    const invalidDeal = { name: 'Invalid Scientific Value', value: '1e21' }

    try {
      const sdkHttpErr = await capture(() => stack.sdkHttp.deals.create(invalidDeal))
      expect(errorCode(sdkHttpErr), 'sdk-http validation code').toBe('VALIDATION_FAILED')
      expectValidationErrorShape(sdkHttpErr, 'sdk-http')

      const sdkDirectErr = await capture(() => stack.sdkDirect.deals.create(invalidDeal))
      expect(errorCode(sdkDirectErr), 'sdk-direct validation code').toBe('VALIDATION_FAILED')
      expectValidationErrorShape(sdkDirectErr, 'sdk-direct')

      const apiResponse = await stack.api.fetch(
        new Request('http://test.local/v1/deals', {
          method: 'POST',
          headers: apiHeaders(stack.rawApiKey),
          body: JSON.stringify(invalidDeal),
        }),
      )
      expect(apiResponse.status, 'raw-api validation status').toBe(400)
      const apiBody = (await apiResponse.json()) as { error?: { code?: string } }
      expect(apiBody.error?.code, 'raw-api validation code').toBe('VALIDATION_FAILED')
      expectValidationErrorShape(apiBody, 'raw-api')

      server = await startApiServer(stack.api)
      const cliResult = await runCli({
        args: ['--mode', 'api', '--json', 'deals', 'create', '--name', invalidDeal.name, '--value', invalidDeal.value],
        cwd: process.cwd(),
        env: {
          ORBIT_BASE_URL: server.baseUrl,
          ORBIT_API_KEY: stack.rawApiKey,
        },
      })
      expect(cliResult.exitCode, 'cli validation exitCode').toBe(1)
      expect(errorCode(cliResult.json), 'cli validation code').toBe('VALIDATION_FAILED')
      expectValidationErrorShape(cliResult.json, 'cli')

      const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
      try {
        expectMcpError(
          await mcp.request('tools/call', {
            name: 'create_record',
            arguments: { object_type: 'deals', record: invalidDeal },
          }),
          'VALIDATION_FAILED',
          'mcp create_record deal validation',
        )
      } finally {
        await mcp.close()
      }
    } finally {
      if (server) await server.close()
      await stack.teardown()
    }
  })
})

function apiHeaders(rawApiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${rawApiKey}`,
    'Orbit-Version': API_VERSION,
    'content-type': 'application/json',
  }
}

function errorCode(err: unknown): string | undefined {
  if (err instanceof OrbitApiError) return err.code
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    if (typeof record.code === 'string') return record.code
    const nested = record.error
    if (nested && typeof nested === 'object') {
      const code = (nested as Record<string, unknown>).code
      if (typeof code === 'string') return code
    }
  }
  return undefined
}

function expectValidationErrorShape(err: unknown, label: string): void {
  const error = err instanceof OrbitApiError ? err.error : (err as { error?: Record<string, unknown> } | undefined)?.error
  expect(error?.code, `${label}: error.code`).toBe('VALIDATION_FAILED')
  expect(error?.request_id, `${label}: error.request_id`).toMatch(/^req_/)
  expect(error?.doc_url, `${label}: error.doc_url`).toBe('https://orbit-ai.dev/docs/errors#validation_failed')
  expect(typeof error?.hint, `${label}: error.hint`).toBe('string')
  expect(error?.retryable, `${label}: error.retryable`).toBe(false)
}

async function capture(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn()
  } catch (err) {
    return err
  }
}
