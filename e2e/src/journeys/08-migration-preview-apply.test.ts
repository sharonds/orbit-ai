import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPostgresStorageAdapter,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  PostgresOrbitDatabase,
  type SchemaMigrationAuthority,
  type StorageAdapter,
} from '@orbit-ai/core'
import { OrbitApiError, OrbitClient } from '@orbit-ai/sdk'
import { buildStack } from '../harness/build-stack.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'
import { runCli } from '../harness/run-cli.js'
import { spawnMcp } from '../harness/run-mcp.js'
import { expectMcpError } from '../harness/mcp-envelope.js'

const adapterType = () => (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres'

type MigrationOperation = {
  type: 'custom_field.delete'
  entityType: 'contacts'
  fieldName: string
}

type MigrationPreview = {
  checksum: string
  operations: MigrationOperation[]
  destructive: boolean
  confirmationRequired: boolean
  confirmationInstructions: {
    required: boolean
    destructiveOperations: string[]
    checksum?: string
  }
}

type MigrationApplyResult = {
  migrationId: string
  checksum: string
  status: 'applied'
  appliedOperations: MigrationOperation[]
  rollbackable: boolean
  rollbackDecision: { decision: 'rollbackable' } | { decision: 'non_rollbackable'; reason: string }
}

type ErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown> | undefined
    request_id?: string | undefined
    retryable?: boolean | undefined
  }
}

type ContactLike = {
  id: string
  custom_fields?: Record<string, unknown>
}

type SchemaObjectLike = {
  customFields?: Array<{ fieldName?: string; name?: string }>
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('Journey 8 - migration preview/apply destructive safety', () => {
  it('API HTTP previews, rejects, confirms, and applies destructive custom-field delete', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: adapterType() })
    try {
      const fieldName = uniqueFieldName('api_delete')
      const operation = customFieldDelete(fieldName)

      await apiRequest(stack.rawApiKey, '/v1/objects/contacts/fields', {
        method: 'POST',
        body: { name: fieldName, type: 'text', label: 'API delete field' },
        expectedStatus: 201,
      })
      const created = await apiRequest<{ data: ContactLike }>(stack.rawApiKey, '/v1/contacts', {
        method: 'POST',
        body: {
          name: 'Journey 8 API',
          email: 'journey8-api@example.test',
          custom_fields: { [fieldName]: 'remove me' },
        },
        expectedStatus: 201,
      })

      const preview = await apiRequest<{ data: MigrationPreview }>(stack.rawApiKey, '/v1/schema/migrations/preview', {
        method: 'POST',
        body: { operations: [operation] },
      })
      expectDestructivePreview(preview.body.data, operation)

      const rejected = await apiRequest<ErrorEnvelope>(stack.rawApiKey, '/v1/schema/migrations/apply', {
        method: 'POST',
        body: { operations: [operation], checksum: preview.body.data.checksum },
        expectedStatus: 409,
      })
      expectStableMigrationError(rejected.body, 'DESTRUCTIVE_CONFIRMATION_REQUIRED', {
        requestId: 'api',
        retryable: false,
      })

      const applied = await apiRequest<{ data: MigrationApplyResult }>(stack.rawApiKey, '/v1/schema/migrations/apply', {
        method: 'POST',
        body: confirmedApplyBody([operation], preview.body.data.checksum),
      })
      expectApplied(applied.body.data, operation, preview.body.data.checksum)

      const schema = await apiRequest<{ data: SchemaObjectLike }>(stack.rawApiKey, '/v1/objects/contacts')
      expectFieldAbsent(schema.body.data, fieldName)
      const contact = await apiRequest<{ data: ContactLike }>(stack.rawApiKey, `/v1/contacts/${created.body.data.id}`)
      expect(contact.body.data.custom_fields?.[fieldName]).toBeUndefined()
    } finally {
      await stack.teardown()
    }
  })

  it.each([
    ['SDK HTTP', (stack: Awaited<ReturnType<typeof buildStack>>) => stack.sdkHttp],
    ['SDK DirectTransport', (stack: Awaited<ReturnType<typeof buildStack>>) => stack.sdkDirect],
  ] as const)('%s previews, rejects, confirms, and applies destructive custom-field delete', async (_label, clientForStack) => {
    const stack = await buildStack({ tenant: 'acme', adapter: adapterType() })
    try {
      const client = clientForStack(stack)
      const fieldName = uniqueFieldName('sdk_delete')
      const operation = customFieldDelete(fieldName)

      await client.schema.addField('contacts', { name: fieldName, type: 'text', label: 'SDK delete field' })
      const contact = await client.contacts.create({
        name: 'Journey 8 SDK',
        email: `${fieldName}@example.test`,
        custom_fields: { [fieldName]: 'remove me' },
      })

      const preview = await client.schema.previewMigration({ operations: [operation] }) as MigrationPreview
      expectDestructivePreview(preview, operation)

      await expectSdkMigrationError(
        () => client.schema.applyMigration({ operations: [operation], checksum: preview.checksum }),
        'DESTRUCTIVE_CONFIRMATION_REQUIRED',
        409,
      )

      const applied = await client.schema.applyMigration(confirmedApplyBody([operation], preview.checksum)) as MigrationApplyResult
      expectApplied(applied, operation, preview.checksum)

      expectFieldAbsent(await client.schema.describeObject('contacts') as SchemaObjectLike, fieldName)
      expect((await client.contacts.get(contact.id)).custom_fields[fieldName]).toBeUndefined()
    } finally {
      await stack.teardown()
    }
  })

  it('CLI direct mode previews, rejects, confirms, and applies destructive custom-field delete', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    let clientHandle: Awaited<ReturnType<typeof openWorkspaceClient>> | undefined
    try {
      clientHandle = await openWorkspaceClient(workspace)
      const fieldName = uniqueFieldName('cli_delete')
      const operation = customFieldDelete(fieldName)

      await clientHandle.client.schema.addField('contacts', {
        name: fieldName,
        type: 'text',
        label: 'CLI delete field',
      })
      const contact = await clientHandle.client.contacts.create({
        name: 'Journey 8 CLI',
        email: `${fieldName}@example.test`,
        custom_fields: { [fieldName]: 'remove me' },
      })
      await clientHandle.close()
      clientHandle = undefined

      const operationsArg = JSON.stringify({ operations: [operation] })
      const previewResult = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--preview', '--operations', operationsArg],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(previewResult.exitCode, cliDebug(previewResult)).toBe(0)
      const preview = previewResult.json as MigrationPreview
      expectDestructivePreview(preview, operation)

      const rejected = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--apply', '--operations', operationsArg],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(rejected.exitCode, cliDebug(rejected)).toBe(1)
      expectStableMigrationError(rejected.json as ErrorEnvelope, 'DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION')
      expect((rejected.json as { error?: { preview?: MigrationPreview } }).error?.preview?.checksum).toBe(preview.checksum)

      const appliedResult = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--apply', '--yes', '--operations', operationsArg],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(appliedResult.exitCode, cliDebug(appliedResult)).toBe(0)
      expectApplied(appliedResult.json as MigrationApplyResult, operation, preview.checksum)

      clientHandle = await openWorkspaceClient(workspace)
      expectFieldAbsent(await clientHandle.client.schema.describeObject('contacts') as SchemaObjectLike, fieldName)
      expect((await clientHandle.client.contacts.get(contact.id)).custom_fields[fieldName]).toBeUndefined()
    } finally {
      await clientHandle?.close()
      await workspace.cleanup()
    }
  })

  it('MCP intentionally excludes destructive schema migration operations', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: adapterType() })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
    try {
      const tools = await mcp.request('tools/list', {})
      const toolNames = tools.tools.map((tool) => tool.name)
      expect(toolNames).toHaveLength(23)
      expect(toolNames).not.toEqual(expect.arrayContaining([
        'preview_schema_migration',
        'apply_schema_migration',
        'rollback_schema_migration',
        'delete_custom_field',
        'rename_custom_field',
        'promote_custom_field',
      ]))

      expectMcpError(
        await mcp.request('tools/call', {
          name: 'update_custom_field',
          arguments: {
            object_type: 'contacts',
            field_name: 'priority',
            field: { fieldType: 'number' },
          },
        }),
        'DEPENDENCY_NOT_AVAILABLE',
        'update_custom_field destructive update',
      )

      const mcpReadme = await readFile(path.join(repoRoot, 'packages/mcp/README.md'), 'utf8')
      expect(mcpReadme).toContain('API/SDK/CLI-only')
      expect(mcpReadme).toContain('migration preview/apply/rollback')
    } finally {
      await mcp.close()
      await stack.teardown()
    }
  })
})

function customFieldDelete(fieldName: string): MigrationOperation {
  return { type: 'custom_field.delete', entityType: 'contacts', fieldName }
}

function uniqueFieldName(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function confirmedApplyBody(operations: MigrationOperation[], checksum: string) {
  return {
    operations,
    checksum,
    confirmation: {
      destructive: true as const,
      checksum,
      confirmedAt: new Date().toISOString(),
    },
  }
}

function expectDestructivePreview(preview: MigrationPreview, operation: MigrationOperation): void {
  expect(preview.operations).toEqual([operation])
  expect(preview.destructive).toBe(true)
  expect(preview.confirmationRequired).toBe(true)
  expect(preview.checksum).toMatch(/^[a-f0-9]{64}$/)
  expect(preview.confirmationInstructions).toMatchObject({
    required: true,
    destructiveOperations: ['custom_field.delete'],
    checksum: preview.checksum,
  })
}

function expectApplied(result: MigrationApplyResult, operation: MigrationOperation, checksum: string): void {
  expect(result).toMatchObject({
    checksum,
    status: 'applied',
    appliedOperations: [operation],
    rollbackable: false,
    rollbackDecision: {
      decision: 'non_rollbackable',
    },
  })
  expect(result.rollbackDecision).toHaveProperty('reason')
  expect(result.migrationId).toMatch(/^migration_/)
}

function expectFieldAbsent(object: SchemaObjectLike, fieldName: string): void {
  const names = (object.customFields ?? []).map((field) => field.fieldName ?? field.name)
  expect(names).not.toContain(fieldName)
}

function expectStableMigrationError(
  envelope: ErrorEnvelope,
  code: string,
  opts: { requestId?: 'api' | 'direct'; retryable?: boolean } = {},
): void {
  expect(envelope.error).toBeTruthy()
  expect(envelope.error?.code).toBe(code)
  expect(typeof envelope.error?.message).toBe('string')
  if (opts.requestId) {
    const pattern = opts.requestId === 'direct' ? /^direct_/ : /^req_/
    expect(envelope.error?.request_id).toMatch(pattern)
  }
  if (opts.retryable !== undefined) {
    expect(envelope.error?.retryable).toBe(opts.retryable)
  }
  expect(JSON.stringify(envelope)).not.toMatch(/\b(ALTER|DROP|CREATE|SECRET|PASSWORD|Bearer)\b/i)
}

async function expectSdkMigrationError(
  action: () => Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  try {
    await action()
    throw new Error('Expected SDK migration request to fail')
  } catch (err) {
    expect(err).toBeInstanceOf(OrbitApiError)
    const apiError = err as OrbitApiError
    expect(apiError.status).toBe(status)
    expectStableMigrationError({ error: { ...apiError.error } }, code, {
      requestId: apiError.request_id?.startsWith('direct_') ? 'direct' : 'api',
      retryable: false,
    })
  }
}

async function apiRequest<T = unknown>(
  apiKey: string,
  pathName: string,
  opts: {
    method?: string
    body?: unknown
    expectedStatus?: number
  } = {},
): Promise<{ status: number; body: T }> {
  const response = await fetch(`http://test.local${pathName}`, {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Orbit-Version': '2026-04-01',
    },
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  })
  const body = await response.json() as T
  expect(response.status, `${opts.method ?? 'GET'} ${pathName}: ${JSON.stringify(body)}`).toBe(opts.expectedStatus ?? 200)
  return { status: response.status, body }
}

async function openWorkspaceClient(workspace: {
  adapter: 'sqlite' | 'postgres'
  databaseUrl: string
  orgId: string
}): Promise<{ client: OrbitClient; close: () => Promise<void> }> {
  const postgresDatabase = workspace.adapter === 'postgres'
    ? new PostgresOrbitDatabase({ connectionString: workspace.databaseUrl })
    : undefined
  const adapter = postgresDatabase
    ? createPostgresStorageAdapter({
        database: postgresDatabase,
        disconnect: async () => postgresDatabase.close(),
      })
    : createSqliteStorageAdapter({
        database: createSqliteOrbitDatabase({ filename: sqliteFilename(workspace.databaseUrl) }),
      })
  const migrationAuthority = migrationAuthorityFor(adapter)
  return {
    client: new OrbitClient({
      adapter,
      context: { orgId: workspace.orgId },
      migrationAuthority,
      destructiveMigrationEnvironment: 'test',
    }),
    close: () => adapter.disconnect(),
  }
}

function migrationAuthorityFor(adapter: StorageAdapter): SchemaMigrationAuthority {
  return {
    run: (_context, fn) => adapter.runWithMigrationAuthority(fn),
  }
}

function sqliteFilename(databaseUrl: string): string {
  return databaseUrl.startsWith('file:') ? new URL(databaseUrl).pathname : databaseUrl
}

function cliDebug(result: { stdout: string; stderr: string }): string {
  return `stdout: ${result.stdout}; stderr: ${result.stderr}`
}
