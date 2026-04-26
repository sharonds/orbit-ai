import { expect } from 'vitest'
import { OrbitApiError } from '@orbit-ai/sdk'
import type { Stack } from '../harness/build-stack.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'
import { runCli } from '../harness/run-cli.js'
import { spawnMcp } from '../harness/run-mcp.js'

export interface CrudMatrixInput {
  readonly entity: 'contacts' | 'companies' | 'deals'
  readonly create: Record<string, unknown>
  readonly update: Record<string, unknown>
  readonly updateField: 'name'
  readonly updateValue: string
  readonly assertField: 'name'
  readonly expectedIdPrefix: string
}

export async function runCrudMatrix(stack: Stack, input: CrudMatrixInput): Promise<void> {
  await runSdkCrud(stack, input)
  await runRawApiCrud(stack, input)
  await runCliCrud(input)
  await runMcpCrud(stack, input)
}

// ========================
// SDK surfaces (HTTP + direct)
// ========================
async function runSdkCrud(stack: Stack, input: CrudMatrixInput): Promise<void> {
  type ResourceRecord = { id: string } & Record<string, unknown>
  type Resource = {
    create(i: Record<string, unknown>): Promise<ResourceRecord>
    get(id: string): Promise<ResourceRecord>
    list(q?: { limit?: number }): Promise<{ data: ResourceRecord[]; meta: { has_more: boolean } }>
    update(id: string, i: Record<string, unknown>): Promise<ResourceRecord>
    delete(id: string): Promise<unknown>
  }

  for (const [label, client] of [
    ['sdk-http', stack.sdkHttp],
    ['sdk-direct', stack.sdkDirect],
  ] as const) {
    const resource = (client as unknown as Record<string, Resource>)[input.entity]!

    const created = await resource.create(input.create)
    expect(created.id, `${label}: created has id`).toMatch(new RegExp(`^${input.expectedIdPrefix}`))

    const page = await resource.list({ limit: 5 })
    expect(page.data.some((r) => r.id === created.id), `${label}: list includes created`).toBe(true)

    const fetched = await resource.get(created.id)
    expect(fetched.id, `${label}: fetched matches`).toBe(created.id)

    const updated = await resource.update(created.id, input.update)
    expect(updated.id, `${label}: update returns same id`).toBe(created.id)
    expect(input.update[input.updateField], `${label}: update config value`).toBe(input.updateValue)

    const refetched = await resource.get(created.id)
    expect(refetched[input.assertField], `${label}: update persisted`).toBe(input.updateValue)

    await resource.delete(created.id)

    try {
      await resource.get(created.id)
      expect.fail(`${label}: get after delete should have thrown`)
    } catch (err) {
      expect(err).toBeInstanceOf(OrbitApiError)
      expect((err as OrbitApiError).error.code).toBe('RESOURCE_NOT_FOUND')
    }
  }
}

// ========================
// Raw API surface (Hono fetch)
// ========================
async function runRawApiCrud(stack: Stack, input: CrudMatrixInput): Promise<void> {
  const base = `http://test.local/v1/${input.entity}`
  const auth = {
    Authorization: `Bearer ${stack.rawApiKey}`,
    'content-type': 'application/json',
  }

  const createRes = await stack.api.fetch(
    new Request(base, { method: 'POST', headers: auth, body: JSON.stringify(input.create) }),
  )
  expect(createRes.status, 'raw-api: create 201').toBe(201)
  const createdEnv = (await createRes.json()) as { data: { id: string } }
  const id = createdEnv.data.id
  expect(id, 'raw-api: created id').toMatch(new RegExp(`^${input.expectedIdPrefix}`))

  const listRes = await stack.api.fetch(
    new Request(`${base}?limit=5`, { headers: auth }),
  )
  expect(listRes.status, 'raw-api: list 200').toBe(200)
  const listEnv = (await listRes.json()) as { data: Array<{ id: string }> }
  expect(listEnv.data.some((r) => r.id === id), 'raw-api: list includes created').toBe(true)

  const getRes = await stack.api.fetch(new Request(`${base}/${id}`, { headers: auth }))
  expect(getRes.status, 'raw-api: get 200').toBe(200)

  const updateRes = await stack.api.fetch(
    new Request(`${base}/${id}`, { method: 'PATCH', headers: auth, body: JSON.stringify(input.update) }),
  )
  expect(updateRes.status, 'raw-api: update 200').toBe(200)
  expect(input.update[input.updateField], 'raw-api: update config value').toBe(input.updateValue)

  const refetchRes = await stack.api.fetch(new Request(`${base}/${id}`, { headers: auth }))
  expect(refetchRes.status, 'raw-api: refetch after update 200').toBe(200)
  const refetchedEnv = (await refetchRes.json()) as { data: Record<string, unknown> }
  expect(refetchedEnv.data[input.assertField], 'raw-api: update persisted').toBe(input.updateValue)

  const deleteRes = await stack.api.fetch(
    new Request(`${base}/${id}`, { method: 'DELETE', headers: auth }),
  )
  expect(deleteRes.status, 'raw-api: delete 200').toBe(200)

  const getAfter = await stack.api.fetch(new Request(`${base}/${id}`, { headers: auth }))
  expect(getAfter.status, 'raw-api: get 404 after delete').toBe(404)
}

// ========================
// CLI surface
// ========================
async function runCliCrud(input: CrudMatrixInput): Promise<void> {
  const workspace = await prepareCliWorkspace({ tenant: 'acme' })
  try {
    const createFlags = toCliFlags(input.create)
    const createRes = await runCli({
      args: ['--mode', 'direct', '--json', input.entity, 'create', ...createFlags],
      cwd: workspace.cwd,
      env: workspace.env,
    })
    expect(createRes.exitCode, `cli: create ${input.entity} exitCode`).toBe(0)
    const createdData = createRes.json as { data?: { id: string }; id?: string } | null
    const createdId =
      (createdData as { data?: { id: string } })?.data?.id ?? (createdData as { id?: string })?.id
    expect(createdId, 'cli: created has id').toMatch(new RegExp(`^${input.expectedIdPrefix}`))
    if (!createdId) return

    const listRes = await runCli({
      args: ['--mode', 'direct', '--json', input.entity, 'list', '--limit', '5'],
      cwd: workspace.cwd,
      env: workspace.env,
    })
    expect(listRes.exitCode, 'cli: list exitCode').toBe(0)
    const listData = listRes.json as
      | { data?: Array<{ id: string }> }
      | Array<{ id: string }>
      | null
    const rows = Array.isArray(listData)
      ? listData
      : (listData as { data?: Array<{ id: string }> })?.data ?? []
    expect(rows.some((r) => r.id === createdId), 'cli: list includes created').toBe(true)

    const getRes = await runCli({
      args: ['--mode', 'direct', '--json', input.entity, 'get', createdId],
      cwd: workspace.cwd,
      env: workspace.env,
    })
    expect(getRes.exitCode, 'cli: get exitCode').toBe(0)

    const updateFlags = toCliFlags(input.update)
    const updateRes = await runCli({
      args: ['--mode', 'direct', '--json', input.entity, 'update', createdId, ...updateFlags],
      cwd: workspace.cwd,
      env: workspace.env,
    })
    expect(updateRes.exitCode, 'cli: update exitCode').toBe(0)
    expect(input.update[input.updateField], 'cli: update config value').toBe(input.updateValue)

    const refetchRes = await runCli({
      args: ['--mode', 'direct', '--json', input.entity, 'get', createdId],
      cwd: workspace.cwd,
      env: workspace.env,
    })
    expect(refetchRes.exitCode, 'cli: refetch after update exitCode').toBe(0)
    expect(readEnvelopeField(refetchRes.json, input.assertField), 'cli: update persisted').toBe(
      input.updateValue,
    )

    const deleteRes = await runCli({
      args: ['--mode', 'direct', input.entity, 'delete', createdId],
      cwd: workspace.cwd,
      env: workspace.env,
    })
    expect(deleteRes.exitCode, 'cli: delete exitCode').toBe(0)
  } finally {
    await workspace.cleanup()
  }
}

function toCliFlags(input: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue
    out.push(`--${kebab(k)}`, String(v))
  }
  return out
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function readEnvelopeField(payload: unknown, field: CrudMatrixInput['assertField']): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  const record = payload as Record<string, unknown>
  if (record[field] !== undefined) return record[field]
  const data = record.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  return (data as Record<string, unknown>)[field]
}

// ========================
// MCP surface (in-process via InMemoryTransport)
// ========================
async function runMcpCrud(stack: Stack, input: CrudMatrixInput): Promise<void> {
  const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
  try {
    const createResp = await mcp.request('tools/call', {
      name: 'create_record',
      arguments: { object_type: input.entity, record: input.create },
    })
    const createText =
      (createResp as { content?: Array<{ text: string }> }).content?.[0]?.text ?? '{}'
    const createdData = JSON.parse(createText) as { id?: string; data?: { id: string } }
    const createdId = createdData.id ?? createdData.data?.id ?? ''
    expect(createdId, 'mcp: create_record returned id').toMatch(
      new RegExp(`^${input.expectedIdPrefix}`),
    )

    const searchResp = await mcp.request('tools/call', {
      name: 'search_records',
      arguments: { object_type: input.entity, limit: 5 },
    })
    const searchText =
      (searchResp as { content?: Array<{ text: string }> }).content?.[0]?.text ?? '{}'
    const searchData = JSON.parse(searchText) as { data: Array<{ id: string }> }
    expect(
      searchData.data.some((r) => r.id === createdId),
      'mcp: search includes created',
    ).toBe(true)

    const getResp = await mcp.request('tools/call', {
      name: 'get_record',
      arguments: { object_type: input.entity, record_id: createdId },
    })
    const getText =
      (getResp as { content?: Array<{ text: string }> }).content?.[0]?.text ?? '{}'
    const getData = JSON.parse(getText) as { id?: string; data?: { id: string } }
    expect(getData.id ?? getData.data?.id, 'mcp: get_record returned same id').toBe(createdId)

    const updateResp = await mcp.request('tools/call', {
      name: 'update_record',
      arguments: { object_type: input.entity, record_id: createdId, record: input.update },
    })
    expect(
      (updateResp as { isError?: boolean }).isError,
      'mcp: update_record not an error',
    ).toBeFalsy()
    expect(input.update[input.updateField], 'mcp: update config value').toBe(input.updateValue)

    const verifyResp = await mcp.request('tools/call', {
      name: 'get_record',
      arguments: { object_type: input.entity, record_id: createdId },
    })
    const verifyText =
      (verifyResp as { content?: Array<{ text: string }> }).content?.[0]?.text ?? '{}'
    const verifyData = JSON.parse(verifyText) as Record<string, unknown>
    expect(readEnvelopeField(verifyData, input.assertField), 'mcp: update persisted').toBe(
      input.updateValue,
    )

    const deleteResp = await mcp.request('tools/call', {
      name: 'delete_record',
      arguments: { object_type: input.entity, record_id: createdId, confirm: true },
    })
    expect(
      (deleteResp as { isError?: boolean }).isError,
      'mcp: delete_record not an error',
    ).toBeFalsy()
  } finally {
    await mcp.close()
  }
}
