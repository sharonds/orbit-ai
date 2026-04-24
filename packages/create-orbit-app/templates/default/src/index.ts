// __APP_NAME__ — scaffolded with create-orbit-app.
// Boots an in-memory SQLite adapter, seeds the Acme Events demo tenant,
// and runs a few SDK queries.
import { createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { OrbitClient } from '@orbit-ai/sdk'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'

async function main() {
  const database = createSqliteOrbitDatabase()
  const adapter = createSqliteStorageAdapter({ database })
  await adapter.migrate()

  console.log('Seeding Acme Events demo tenant…')
  const result = await seed(adapter, { profile: TENANT_PROFILES.acme })
  console.log(`  org: ${result.organization.id}  (${result.organization.name})`)
  console.log(`  contacts: ${result.counts.contacts}`)
  console.log(`  companies: ${result.counts.companies}`)
  console.log(`  deals: ${result.counts.deals}`)

  const client = new OrbitClient({
    adapter,
    context: { orgId: result.organization.id },
  })

  const page = await client.contacts.list({ limit: 5 })
  console.log(`\nFirst 5 contacts (of ${result.counts.contacts}):`)
  for (const c of page.data) {
    console.log(`  ${c.id}  ${c.name}  <${c.email ?? '—'}>`)
  }

  const companies = await client.companies.list({ limit: 3 })
  console.log('\nFirst 3 companies:')
  for (const co of companies.data) {
    console.log(`  ${co.id}  ${co.name}  ${co.industry ?? '—'}`)
  }

  console.log('\nNext: open src/index.ts and start editing.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
