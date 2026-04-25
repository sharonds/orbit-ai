import { describe, it, expect } from 'vitest'
import { OrbitApiError, OrbitClient } from '@orbit-ai/sdk'
import { buildStack, type Stack } from '../harness/build-stack.js'
import { startApiServer, type StartedApiServer } from '../harness/api-server.js'
import { runCli, type CliResult } from '../harness/run-cli.js'
import { spawnMcp } from '../harness/run-mcp.js'

type AdapterName = 'sqlite' | 'postgres'
type EntityName = 'contacts' | 'deals'

interface EntityCase {
  readonly entity: EntityName
  readonly update: Record<string, unknown>
}

interface RecordRef {
  readonly id: string
}

type EntitySnapshots = Record<EntityName, Record<string, unknown>>

interface ListEnvelope {
  readonly data?: RecordRef[]
  readonly meta?: {
    readonly next_cursor?: string | null
    readonly has_more?: boolean
  }
}

interface ToolEnvelope {
  readonly ok?: boolean
  readonly data?: RecordRef[] | Record<string, unknown>
  readonly error?: { readonly code?: string }
}

const API_VERSION = '2026-04-01'
const ENTITY_CASES: readonly EntityCase[] = [
  { entity: 'contacts', update: { name: 'Acme Should Not See Beta Contact' } },
  { entity: 'deals', update: { name: 'Acme Should Not See Beta Deal' } },
]

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

async function capture(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn()
  } catch (err) {
    return err
  }
}

describe('Journey 15 — tenant isolation across shared-datastore surfaces', () => {
  it('returns not found for beta contact/deal IDs from every acme-bound surface', async () => {
    const adapter = (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as AdapterName
    const stack = await buildStack({ tenant: 'both', adapter })
    let server: StartedApiServer | undefined

    try {
      expect(stack.betaOrgId, 'beta org must be seeded for tenant isolation journey').toBeTruthy()
      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: stack.betaOrgId! },
      })
      const betaIds = await discoverBetaIds(betaClient)
      const betaSnapshots = await snapshotBetaRecords(betaClient, betaIds)

      for (const entityCase of ENTITY_CASES) {
        await assertSdkIsolation(stack, entityCase, betaIds[entityCase.entity])
        await assertRawApiIsolation(stack, entityCase, betaIds[entityCase.entity])
      }
      await assertBetaRecordsUnchanged(betaClient, betaIds, betaSnapshots, 'sdk/raw-api')

      server = await startApiServer(stack.api)
      for (const entityCase of ENTITY_CASES) {
        await assertCliIsolation(server, stack, entityCase, betaIds[entityCase.entity])
      }
      await assertBetaRecordsUnchanged(betaClient, betaIds, betaSnapshots, 'cli')

      await assertMcpIsolation(stack, betaIds)
      await assertBetaRecordsUnchanged(betaClient, betaIds, betaSnapshots, 'mcp')
    } finally {
      if (server) await server.close()
      await stack.teardown()
    }
  })
})

async function discoverBetaIds(client: OrbitClient): Promise<Record<EntityName, string>> {
  const contacts = await client.contacts.list({ limit: 1 })
  const deals = await client.deals.list({ limit: 1 })
  const contactId = contacts.data[0]?.id
  const dealId = deals.data[0]?.id

  expect(contactId, 'beta seed should include contacts').toMatch(/^contact_/)
  expect(dealId, 'beta seed should include deals').toMatch(/^deal_/)

  return {
    contacts: contactId!,
    deals: dealId!,
  }
}

async function snapshotBetaRecords(client: OrbitClient, betaIds: Record<EntityName, string>): Promise<EntitySnapshots> {
  return {
    contacts: await client.contacts.get(betaIds.contacts) as unknown as Record<string, unknown>,
    deals: await client.deals.get(betaIds.deals) as unknown as Record<string, unknown>,
  }
}

async function assertBetaRecordsUnchanged(
  client: OrbitClient,
  betaIds: Record<EntityName, string>,
  snapshots: EntitySnapshots,
  label: string,
): Promise<void> {
  expect(await client.contacts.get(betaIds.contacts), `${label}: beta contact unchanged`).toEqual(snapshots.contacts)
  expect(await client.deals.get(betaIds.deals), `${label}: beta deal unchanged`).toEqual(snapshots.deals)
}

async function assertSdkIsolation(stack: Stack, entityCase: EntityCase, betaId: string): Promise<void> {
  for (const [label, client] of [
    ['sdk-http', stack.sdkHttp],
    ['sdk-direct', stack.sdkDirect],
  ] as const) {
    const resource = client[entityCase.entity]

    await expect(capture(() => resource.get(betaId)), `${label}: ${entityCase.entity} get`).resolves.toSatisfy(
      (err: unknown) => errorCode(err) === 'RESOURCE_NOT_FOUND',
    )
    await expect(
      capture(() => resource.update(betaId, entityCase.update)),
      `${label}: ${entityCase.entity} update`,
    ).resolves.toSatisfy((err: unknown) => errorCode(err) === 'RESOURCE_NOT_FOUND')
    await expect(capture(() => resource.delete(betaId)), `${label}: ${entityCase.entity} delete`).resolves.toSatisfy(
      (err: unknown) => errorCode(err) === 'RESOURCE_NOT_FOUND',
    )

    const ids = await listAllSdkIds(resource)
    expect(ids, `${label}: ${entityCase.entity} list excludes beta id`).not.toContain(betaId)
  }
}

async function listAllSdkIds(
  resource: OrbitClient[EntityName],
): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = await resource.list({ limit: 100, ...(cursor ? { cursor } : {}) })
    ids.push(...page.data.map((row) => row.id))
    cursor = page.meta.next_cursor ?? undefined
  } while (cursor)
  return ids
}

async function assertRawApiIsolation(stack: Stack, entityCase: EntityCase, betaId: string): Promise<void> {
  const headers = apiHeaders(stack.rawApiKey)
  const base = `http://test.local/v1/${entityCase.entity}`

  for (const [method, init] of [
    ['GET', { method: 'GET', headers }],
    ['PATCH', { method: 'PATCH', headers, body: JSON.stringify(entityCase.update) }],
    ['DELETE', { method: 'DELETE', headers }],
  ] as const) {
    const response = await stack.api.fetch(new Request(`${base}/${betaId}`, init))
    expect(response.status, `raw-api: ${method} ${entityCase.entity} beta id status`).toBe(404)
    const body = (await response.json()) as { error?: { code?: string } }
    expect(body.error?.code, `raw-api: ${method} ${entityCase.entity} beta id code`).toBe('RESOURCE_NOT_FOUND')
  }

  const ids = await listAllRawApiIds(stack, entityCase.entity)
  expect(ids, `raw-api: ${entityCase.entity} list excludes beta id`).not.toContain(betaId)
}

function apiHeaders(rawApiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${rawApiKey}`,
    'Orbit-Version': API_VERSION,
    'content-type': 'application/json',
  }
}

async function listAllRawApiIds(stack: Stack, entity: EntityName): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const url = new URL(`http://test.local/v1/${entity}`)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const response = await stack.api.fetch(new Request(url, { headers: apiHeaders(stack.rawApiKey) }))
    expect(response.status, `raw-api: ${entity} list status`).toBe(200)
    const body = (await response.json()) as ListEnvelope
    ids.push(...(body.data ?? []).map((row) => row.id))
    cursor = body.meta?.next_cursor ?? undefined
  } while (cursor)
  return ids
}

async function assertCliIsolation(
  server: StartedApiServer,
  stack: Stack,
  entityCase: EntityCase,
  betaId: string,
): Promise<void> {
  const baseArgs = ['--mode', 'api', '--json'] as const
  const env = {
    ORBIT_BASE_URL: server.baseUrl,
    ORBIT_API_KEY: stack.rawApiKey,
  }

  for (const [verb, args] of [
    ['get', [...baseArgs, entityCase.entity, 'get', betaId]],
    ['update', [...baseArgs, entityCase.entity, 'update', betaId, '--name', String(entityCase.update.name)]],
    ['delete', [...baseArgs, entityCase.entity, 'delete', betaId]],
  ] as const) {
    const result = await runCli({ args, cwd: process.cwd(), env })
    expect(result.exitCode, `cli: ${entityCase.entity} ${verb} beta id exitCode`).toBe(1)
    expect(errorCode(result.json), `cli: ${entityCase.entity} ${verb} beta id code`).toBe('RESOURCE_NOT_FOUND')
  }

  const ids = await listAllCliIds(server, stack, entityCase.entity)
  expect(ids, `cli: ${entityCase.entity} list excludes beta id`).not.toContain(betaId)
}

async function listAllCliIds(server: StartedApiServer, stack: Stack, entity: EntityName): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | undefined
  const env = {
    ORBIT_BASE_URL: server.baseUrl,
    ORBIT_API_KEY: stack.rawApiKey,
  }

  do {
    const args = ['--mode', 'api', '--json', entity, 'list', '--limit', '100']
    if (cursor) args.push('--cursor', cursor)
    const result: CliResult = await runCli({ args, cwd: process.cwd(), env })
    expect(result.exitCode, `cli: ${entity} list exitCode`).toBe(0)
    const body = result.json as ListEnvelope | null | undefined
    ids.push(...(body?.data ?? []).map((row) => row.id))
    cursor = body?.meta?.next_cursor ?? undefined
  } while (cursor)

  return ids
}

async function assertMcpIsolation(stack: Stack, betaIds: Record<EntityName, string>): Promise<void> {
  const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
  try {
    for (const entityCase of ENTITY_CASES) {
      const betaId = betaIds[entityCase.entity]

      for (const [tool, args] of [
        ['get_record', { object_type: entityCase.entity, record_id: betaId }],
        ['update_record', { object_type: entityCase.entity, record_id: betaId, record: entityCase.update }],
        ['delete_record', { object_type: entityCase.entity, record_id: betaId, confirm: true }],
      ] as const) {
        const response = await mcp.request('tools/call', { name: tool, arguments: args })
        expect(response.isError, `mcp: ${tool} ${entityCase.entity} beta id isError`).toBe(true)
        expect(toolErrorCode(response), `mcp: ${tool} ${entityCase.entity} beta id code`).toBe(
          'RESOURCE_NOT_FOUND',
        )
      }

      const ids = await searchMcpIdsById(mcp, entityCase.entity, betaId)
      expect(ids, `mcp: ${entityCase.entity} exact-id search excludes beta id`).not.toContain(betaId)
    }
  } finally {
    await mcp.close()
  }
}

async function searchMcpIdsById(
  mcp: Awaited<ReturnType<typeof spawnMcp>>,
  entity: EntityName,
  betaId: string,
): Promise<string[]> {
  const response = await mcp.request('tools/call', {
    name: 'search_records',
    arguments: { object_type: entity, filter: { id: betaId }, limit: 100 },
  })
  expect(response.isError, `mcp: search_records ${entity} by beta id should succeed`).toBeFalsy()
  const body = parseToolEnvelope(response)
  const rows = Array.isArray(body.data) ? body.data : []
  return rows.map((row) => row.id)
}

function toolErrorCode(response: { content?: Array<{ text: string }> }): string | undefined {
  return parseToolEnvelope(response).error?.code
}

function parseToolEnvelope(response: { content?: Array<{ text: string }> }): ToolEnvelope {
  const text = response.content?.[0]?.text ?? '{}'
  return JSON.parse(text) as ToolEnvelope
}
