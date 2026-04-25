import { describe, expect, it } from 'vitest'
import { OrbitClient } from '@orbit-ai/sdk'
import type { StorageAdapter } from '@orbit-ai/core'
import { sql } from 'drizzle-orm'
import { buildStack } from '../harness/build-stack.js'
import { spawnMcp } from '../harness/run-mcp.js'
import { expectMcpSuccess } from '../harness/mcp-envelope.js'

type AdapterName = 'sqlite' | 'postgres'

interface SchemaObject {
  readonly type?: string
  readonly customFields?: readonly object[]
  readonly custom_fields?: readonly object[]
}

interface Envelope<T> {
  readonly data?: T
}

const FIELD_NAME = 'linkedin_url'

describe('Journey 12 — schema read parity and tenant isolation', () => {
  it('keeps beta custom field metadata out of acme-bound schema reads across surfaces', async () => {
    const adapter = (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as AdapterName
    const stack = await buildStack({ tenant: 'both', adapter })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })

    try {
      expect(stack.betaOrgId, 'beta org must be seeded for schema parity journey').toBeTruthy()
      await cleanupLinkedinField(stack.adapter, stack.acmeOrgId, stack.betaOrgId!)

      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: stack.betaOrgId! },
      })
      await betaClient.schema.addField('contacts', {
        name: FIELD_NAME,
        label: 'LinkedIn URL',
        type: 'url',
      })
      assertObjectContainsField(await betaClient.schema.describeObject('contacts'), FIELD_NAME, 'beta sdk-direct describeObject')
      assertObjectListContainsField(await betaClient.schema.listObjects(), FIELD_NAME, 'beta sdk-direct listObjects')

      await assertRawApiSchemaReadsOmitField(stack.rawApiKey, stack.api, FIELD_NAME)
      assertObjectListOmitsField(await stack.sdkHttp.schema.listObjects(), FIELD_NAME, 'sdk-http listObjects')
      assertObjectOmitsField(await stack.sdkHttp.schema.describeObject('contacts'), FIELD_NAME, 'sdk-http describeObject')
      assertObjectListOmitsField(await stack.sdkDirect.schema.listObjects(), FIELD_NAME, 'sdk-direct listObjects')
      assertObjectOmitsField(await stack.sdkDirect.schema.describeObject('contacts'), FIELD_NAME, 'sdk-direct describeObject')

      const schemaPayload = expectMcpSuccess(
        await mcp.request('tools/call', { name: 'get_schema', arguments: { object_type: 'contacts' } }),
        'mcp get_schema contacts',
      )
      assertObjectOmitsField(schemaPayload.data as SchemaObject, FIELD_NAME, 'mcp get_schema contacts')

      const resources = await mcp.request('resources/list', {})
      expect(resources.resources.some((resource) => resource.uri === 'orbit://schema')).toBe(true)
      const schemaResource = await mcp.request('resources/read', { uri: 'orbit://schema' })
      const text = schemaResource.contents.find((content) => content.uri === 'orbit://schema')?.text
      expect(text, 'orbit://schema resource text').toBeTruthy()
      const parsed = JSON.parse(text!) as { data?: SchemaObject[] }
      assertObjectListOmitsField(parsed.data ?? [], FIELD_NAME, 'mcp orbit://schema resource')
    } finally {
      await cleanupLinkedinField(stack.adapter, stack.acmeOrgId, stack.betaOrgId)
      await mcp.close()
      await stack.teardown()
    }
  })
})

async function assertRawApiSchemaReadsOmitField(
  rawApiKey: string,
  api: { fetch(request: Request): Response | Promise<Response> },
  fieldName: string,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${rawApiKey}`,
    'Orbit-Version': '2026-04-01',
  }

  const listResponse = await Promise.resolve(api.fetch(new Request('http://test.local/v1/objects', { headers })))
  expect(listResponse.status, 'raw-api listObjects status').toBe(200)
  const listBody = (await listResponse.json()) as Envelope<SchemaObject[]>
  assertObjectListOmitsField(listBody.data ?? [], fieldName, 'raw-api listObjects')

  const getResponse = await Promise.resolve(api.fetch(new Request('http://test.local/v1/objects/contacts', { headers })))
  expect(getResponse.status, 'raw-api getObject contacts status').toBe(200)
  const getBody = (await getResponse.json()) as Envelope<SchemaObject>
  assertObjectOmitsField(getBody.data ?? {}, fieldName, 'raw-api getObject contacts')
}

function assertObjectListOmitsField(objects: SchemaObject[], fieldName: string, label: string): void {
  const contacts = objects.find((object) => object.type === 'contacts')
  expect(contacts, `${label}: contacts object exists`).toBeTruthy()
  assertObjectOmitsField(contacts!, fieldName, label)
}

function assertObjectOmitsField(object: SchemaObject, fieldName: string, label: string): void {
  expect(fieldNames(object), `${label}: custom field names`).not.toContain(fieldName)
}

function assertObjectListContainsField(objects: SchemaObject[], fieldName: string, label: string): void {
  const contacts = objects.find((object) => object.type === 'contacts')
  expect(contacts, `${label}: contacts object exists`).toBeTruthy()
  assertObjectContainsField(contacts!, fieldName, label)
}

function assertObjectContainsField(object: SchemaObject, fieldName: string, label: string): void {
  expect(fieldNames(object), `${label}: custom field names`).toContain(fieldName)
}

function fieldNames(object: SchemaObject): string[] {
  return [...(object.customFields ?? []), ...(object.custom_fields ?? [])]
    .map((field) => {
      const record = field as Record<string, unknown>
      return record.fieldName ?? record.field_name ?? record.name
    })
    .filter((name): name is string => typeof name === 'string')
}

async function cleanupLinkedinField(
  adapter: StorageAdapter,
  acmeOrgId: string,
  betaOrgId: string | undefined,
): Promise<void> {
  const orgIds = betaOrgId ? [acmeOrgId, betaOrgId] : [acmeOrgId]
  await adapter.unsafeRawDatabase.execute(sql`
    DELETE FROM custom_field_definitions
    WHERE organization_id IN (${sql.join(orgIds.map((orgId) => sql`${orgId}`), sql`, `)})
      AND entity_type = ${'contacts'}
      AND field_name = ${FIELD_NAME}
  `)
}
