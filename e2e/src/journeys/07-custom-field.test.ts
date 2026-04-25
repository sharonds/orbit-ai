import { describe, it, expect } from 'vitest'
import { runCli } from '../harness/run-cli.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'
import { PostgresOrbitDatabase, createCoreServices, createPostgresStorageAdapter } from '@orbit-ai/core'

describe('Journey 7 — inspect schema + add a custom field safely', () => {
  it('orbit schema list includes core entities; orbit fields create works end-to-end', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      if (process.env.ORBIT_E2E_ADAPTER === 'postgres') {
        expect(workspace.adapter).toBe('postgres')
        expect(workspace.databaseUrl).toMatch(/^postgres/)
      }

      // schema list — global --json flag before subcommand
      const schemaList = await runCli({
        args: ['--mode', 'direct', '--json', 'schema', 'list'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(schemaList.exitCode, `schema list exitCode (stdout: ${schemaList.stdout}; stderr: ${schemaList.stderr})`).toBe(0)

      // Output is OrbitEnvelope: { data: Array<{ type: string, custom_fields: [] }> }
      const listEnv = schemaList.json as { data?: Array<{ type?: string }> } | Array<{ type?: string }> | null
      const objects = Array.isArray(listEnv) ? listEnv : (listEnv as { data?: Array<{ type?: string }> })?.data ?? []
      const types = objects.map((o) => o.type).filter((t): t is string => Boolean(t))
      expect(types).toContain('contacts')
      expect(types).toContain('companies')
      expect(types).toContain('deals')

      // fields create — entity is POSITIONAL, not --entity flag
      const add = await runCli({
        args: ['--mode', 'direct', 'fields', 'create', 'contacts', '--name', 'lifetime_value', '--type', 'number'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(add.exitCode, `fields create exitCode (stdout: ${add.stdout}; stderr: ${add.stderr})`).toBe(0)

      // schema get contacts — verify field was added
      const after = await runCli({
        args: ['--mode', 'direct', '--json', 'schema', 'get', 'contacts'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(after.exitCode, `schema get exitCode (stdout: ${after.stdout}; stderr: ${after.stderr})`).toBe(0)

      // Output is OrbitEnvelope: { data: { type: 'contacts', custom_fields: [...] } }
      const getEnv = after.json as { data?: { custom_fields?: Array<{ field_name?: string; fieldName?: string }> } } | { custom_fields?: Array<{ field_name?: string; fieldName?: string }> } | null
      const contactsObj = (getEnv as { data?: { custom_fields?: Array<{ field_name?: string; fieldName?: string }> } })?.data ?? (getEnv as { custom_fields?: Array<{ field_name?: string; fieldName?: string }> })
      const fields = contactsObj?.custom_fields ?? []
      expect(fields.some((f) => (f.field_name ?? f.fieldName) === 'lifetime_value'), 'lifetime_value field should be present').toBe(true)

      if (workspace.adapter === 'postgres') {
        await expectFreshPostgresSchemaRead(workspace.databaseUrl, workspace.orgId)
        workspace.proof.verifiedBy = 'fresh-adapter-read'
        expect(workspace.proof.verifiedBy).toBe('fresh-adapter-read')
      }
    } finally {
      await workspace.cleanup()
    }
  })
})

async function expectFreshPostgresSchemaRead(databaseUrl: string, orgId: string): Promise<void> {
  const database = new PostgresOrbitDatabase({ connectionString: databaseUrl })
  const adapter = createPostgresStorageAdapter({
    database,
    disconnect: async () => database.close(),
  })
  try {
    const services = createCoreServices(adapter)
    const contacts = await services.schema.getObject({ orgId }, 'contacts')
    expect(
      contacts?.customFields.some((field) => field.fieldName === 'lifetime_value'),
      'fresh Postgres adapter read should see CLI-created custom field',
    ).toBe(true)
  } finally {
    await adapter.disconnect()
  }
}
