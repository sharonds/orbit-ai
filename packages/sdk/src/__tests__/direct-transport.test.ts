import { describe, it, expect, vi } from 'vitest'
import { DirectTransport, resolveServiceKey } from '../transport/direct-transport.js'
import {
  SqliteStorageAdapter,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  initializeSqliteWave2SliceESchema,
  createSqliteOrganizationRepository,
} from '@orbit-ai/core'
import type { StorageAdapter } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'

describe('DirectTransport', () => {
  it('requires adapter and context.orgId', () => {
    expect(() => new DirectTransport({} as any)).toThrow('Direct transport requires adapter and context.orgId')

    expect(() => new DirectTransport({ adapter: {} as any } as any)).toThrow(
      'Direct transport requires adapter and context.orgId',
    )

    expect(() => new DirectTransport({ context: { orgId: 'org_1' } } as any)).toThrow(
      'Direct transport requires adapter and context.orgId',
    )
  })

  it('constructor does not call runWithMigrationAuthority', () => {
    const mockAdapter = {
      name: 'sqlite' as const,
      dialect: 'sqlite' as const,
      runWithMigrationAuthority: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    }

    // DirectTransport will try to create core services with this adapter,
    // which may fail — but the key assertion is that runWithMigrationAuthority is NOT called.
    try {
      new DirectTransport({
        adapter: mockAdapter as any,
        context: { orgId: 'org_1' },
      })
    } catch {
      // Construction may fail with mock adapter — that is OK
    }

    expect(mockAdapter.runWithMigrationAuthority).not.toHaveBeenCalled()
  })

  it('request does not call runWithMigrationAuthority', async () => {
    const mockAdapter = {
      name: 'sqlite' as const,
      dialect: 'sqlite' as const,
      runWithMigrationAuthority: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    }

    let transport: DirectTransport | undefined
    try {
      transport = new DirectTransport({
        adapter: mockAdapter as any,
        context: { orgId: 'org_1' },
      })
    } catch {
      // Construction may fail with mock adapter
    }

    if (transport) {
      try {
        await transport.request({ method: 'GET', path: '/contacts/cid_1' })
      } catch {
        // Expected to fail with mock adapter
      }
    }

    expect(mockAdapter.runWithMigrationAuthority).not.toHaveBeenCalled()
  })
})

function createTestAdapter(): StorageAdapter {
  const runtimeDb = {
    async transaction<T>(fn: (tx: typeof runtimeDb) => Promise<T>) {
      return fn(runtimeDb)
    },
    async execute(_statement: unknown) {
      return undefined
    },
    async query() {
      return []
    },
  }

  return new SqliteStorageAdapter({ database: runtimeDb })
}

function makeDirectOptions(): OrbitClientOptions {
  return {
    adapter: createTestAdapter(),
    context: { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    version: '2026-04-01',
  }
}

describe('resolveServiceKey', () => {
  it('maps sequence_steps to sequenceSteps', () => {
    expect(resolveServiceKey('sequence_steps')).toBe('sequenceSteps')
  })

  it('maps sequence_enrollments to sequenceEnrollments', () => {
    expect(resolveServiceKey('sequence_enrollments')).toBe('sequenceEnrollments')
  })

  it('maps sequence_events to sequenceEvents', () => {
    expect(resolveServiceKey('sequence_events')).toBe('sequenceEvents')
  })

  it('passes through non-underscored entities unchanged', () => {
    expect(resolveServiceKey('contacts')).toBe('contacts')
    expect(resolveServiceKey('deals')).toBe('deals')
    expect(resolveServiceKey('companies')).toBe('companies')
    expect(resolveServiceKey('pipelines')).toBe('pipelines')
    expect(resolveServiceKey('tags')).toBe('tags')
  })
})

describe('DirectTransport underscored entity dispatch', () => {
  it('routes GET /v1/sequence_steps to the sequenceSteps service', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = await transport.request({ method: 'GET', path: '/v1/sequence_steps' })
    expect(result.meta).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('routes GET /v1/sequence_enrollments to the sequenceEnrollments service', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = await transport.request({ method: 'GET', path: '/v1/sequence_enrollments' })
    expect(result.meta).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('routes GET /v1/sequence_events to the sequenceEvents service', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = await transport.request({ method: 'GET', path: '/v1/sequence_events' })
    expect(result.meta).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })
})

const ORG_ID = 'org_01ARYZ6S41YYYYYYYYYYYYYYYY'

async function createRealAdapter(): Promise<StorageAdapter> {
  const database = createSqliteOrbitDatabase()
  await initializeSqliteWave2SliceESchema(database)
  const adapter = createSqliteStorageAdapter({
    database,
    getSchemaSnapshot: async () => ({
      customFields: [],
      tables: [
        'organizations', 'users', 'organization_memberships', 'api_keys',
        'companies', 'contacts', 'pipelines', 'stages', 'deals',
        'activities', 'tasks', 'notes', 'products', 'payments', 'contracts',
        'sequences', 'sequence_steps', 'sequence_enrollments', 'sequence_events',
        'tags', 'entity_tags', 'imports', 'webhooks', 'webhook_deliveries',
        'custom_field_definitions', 'audit_logs', 'schema_migrations', 'idempotency_keys',
      ],
    }),
  })
  const organizations = createSqliteOrganizationRepository(adapter)
  await organizations.create({
    id: ORG_ID,
    name: 'Acme',
    slug: 'acme',
    plan: 'community',
    isActive: true,
    settings: {},
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  })
  return adapter
}

describe('DirectTransport wrapEnvelope links.next', () => {
  it('populates links.next when hasMore is true', async () => {
    const adapter = await createRealAdapter()
    const transport = new DirectTransport({
      adapter,
      context: { orgId: ORG_ID },
      version: '2026-04-01',
    })
    const ctx = { orgId: ORG_ID, scopes: ['*'] as const }

    // Create 2 contacts so a limit=1 list will have has_more=true
    await adapter.withTenantContext(ctx, async () => {
      await transport.request({
        method: 'POST',
        path: '/v1/contacts',
        body: { name: 'Alice', email: 'alice@example.com' },
      })
      await transport.request({
        method: 'POST',
        path: '/v1/contacts',
        body: { name: 'Bob', email: 'bob@example.com' },
      })
    })

    const result = await transport.request({
      method: 'GET',
      path: '/v1/contacts',
      query: { limit: 1 },
    })

    expect(result.meta.has_more).toBe(true)
    expect(result.links.next).toBeDefined()
    expect(typeof result.links.next).toBe('string')
    expect(result.links.next).toContain('cursor=')
  })

  it('leaves links.next undefined when there is no next page', async () => {
    const adapter = await createRealAdapter()
    const transport = new DirectTransport({
      adapter,
      context: { orgId: ORG_ID },
      version: '2026-04-01',
    })

    // List with no contacts — has_more will be false
    const result = await transport.request({
      method: 'GET',
      path: '/v1/contacts',
      query: { limit: 10 },
    })

    expect(result.meta.has_more).toBe(false)
    expect(result.links.next).toBeUndefined()
  })
})
