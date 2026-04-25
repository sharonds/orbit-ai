import { describe, it, expect, vi } from 'vitest'
import { OrbitClient } from '../client.js'
import { OrbitApiError } from '../errors.js'
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

  it('omits links.next for POST /v1/search because the cursor belongs in the body', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = (transport as any).wrapEnvelope('POST', '/v1/search', undefined, {
      data: [{ id: 'contact_01' }],
      nextCursor: 'cursor_body',
      hasMore: true,
    })

    expect(result.meta.has_more).toBe(true)
    expect(result.meta.next_cursor).toBe('cursor_body')
    expect(result.links.next).toBeUndefined()
  })

  it('omits links.next for POST /v1/contacts/search because the cursor belongs in the body', async () => {
    const adapter = await createRealAdapter()
    const transport = new DirectTransport({
      adapter,
      context: { orgId: ORG_ID },
      version: '2026-04-01',
    })
    const ctx = { orgId: ORG_ID, scopes: ['*'] as const }

    await adapter.withTenantContext(ctx, async () => {
      await transport.request({
        method: 'POST',
        path: '/v1/contacts',
        body: { name: 'Alice Entity Search', email: 'alice-entity@example.com' },
      })
      await transport.request({
        method: 'POST',
        path: '/v1/contacts',
        body: { name: 'Bob Entity Search', email: 'bob-entity@example.com' },
      })
    })

    const result = await transport.request({
      method: 'POST',
      path: '/v1/contacts/search',
      body: { query: 'Entity Search', limit: 1 },
    })

    expect(result.meta.has_more).toBe(true)
    expect(result.meta.next_cursor).toBeTruthy()
    expect(result.links.next).toBeUndefined()
  })
})

describe('DirectTransport workflow sub-routes', () => {
  async function createWorkflowClient() {
    const adapter = await createRealAdapter()
    const transport = new DirectTransport({
      adapter,
      context: { orgId: ORG_ID },
      version: '2026-04-01',
    })
    const client = new OrbitClient({
      adapter,
      context: { orgId: ORG_ID },
      version: '2026-04-01',
    })

    return { adapter, transport, client }
  }

  it('moves deals and reads deal workflow aggregates in direct mode', async () => {
    const { transport, client } = await createWorkflowClient()
    const pipeline = (await transport.request({
      method: 'POST',
      path: '/v1/pipelines',
      body: { name: 'Sales' },
    })).data as { id: string }
    const firstStage = (await transport.request({
      method: 'POST',
      path: '/v1/stages',
      body: { name: 'Qualified', pipelineId: pipeline.id, stageOrder: 1 },
    })).data as { id: string }
    const secondStage = (await transport.request({
      method: 'POST',
      path: '/v1/stages',
      body: { name: 'Proposal', pipelineId: pipeline.id, stageOrder: 2 },
    })).data as { id: string }
    const deal = (await transport.request({
      method: 'POST',
      path: '/v1/deals',
      body: { name: 'Expansion', stageId: firstStage.id, value: 2500 },
    })).data as { id: string }

    const moved = await client.deals.move(deal.id, { stage_id: secondStage.id }) as { stage_id?: string }
    const pipelineView = await client.deals.pipeline() as { pipelines: unknown[] }
    const stats = await client.deals.stats() as { count: number }

    expect(moved.stage_id).toBe(secondStage.id)
    expect(pipelineView.pipelines.length).toBeGreaterThan(0)
    expect(stats.count).toBeGreaterThanOrEqual(1)
  })

  it('logs activities, enrolls and unenrolls sequences, and attaches/detaches tags in direct mode', async () => {
    const { transport, client } = await createWorkflowClient()
    const contact = (await transport.request({
      method: 'POST',
      path: '/v1/contacts',
      body: { name: 'Ada Lovelace', email: 'ada@example.com' },
    })).data as { id: string }
    const sequence = (await transport.request({
      method: 'POST',
      path: '/v1/sequences',
      body: { name: 'Welcome' },
    })).data as { id: string }
    const tag = (await transport.request({
      method: 'POST',
      path: '/v1/tags',
      body: { name: 'Priority' },
    })).data as { id: string }

    const activity = await client.activities.log({
      type: 'call',
      subject: 'Intro',
      contact_id: contact.id,
      occurred_at: '2026-04-24T10:00:00.000Z',
    }) as { contact_id?: string }
    const enrollment = await client.sequences.enroll(sequence.id, { contact_id: contact.id }) as { id: string; sequence_id?: string }
    const unenrolled = await client.sequenceEnrollments.unenroll(enrollment.id) as { status?: string }
    const attached = await client.tags.attach(tag.id, { entity_type: 'contacts', entity_id: contact.id }) as { tag_id?: string }
    const detached = await client.tags.detach(tag.id, { entity_type: 'contacts', entity_id: contact.id }) as { detached?: boolean }

    expect(activity.contact_id).toBe(contact.id)
    expect(enrollment.sequence_id).toBe(sequence.id)
    expect(unenrolled.status).toBe('exited')
    expect(attached.tag_id).toBe(tag.id)
    expect(detached.detached).toBe(true)
  })

  it('preserves HTTP schema metadata shape in direct mode', async () => {
    const { client } = await createWorkflowClient()
    await client.schema.addField('contacts', {
      name: 'linkedin_url',
      label: 'LinkedIn URL',
      type: 'url',
    })

    const object = await client.schema.describeObject('contacts')
    expect(object.customFields.some((field) => field.fieldName === 'linkedin_url')).toBe(true)
    expect(object).not.toHaveProperty('custom_fields')

    const objects = await client.schema.listObjects()
    const contacts = objects.find((item) => item.type === 'contacts')
    expect(contacts?.customFields.some((field) => field.fieldName === 'linkedin_url')).toBe(true)
    expect(contacts).not.toHaveProperty('custom_fields')
  })

  it('returns typed validation errors for missing schema field bodies in direct mode', async () => {
    const { transport } = await createWorkflowClient()

    await expect(
      transport.request({
        method: 'POST',
        path: '/v1/objects/contacts/fields',
      }),
    ).rejects.toMatchObject<Partial<OrbitApiError>>({
      error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      status: 400,
    })
  })

  it('maps Zod validation errors to API-shaped errors in direct mode', async () => {
    const { transport } = await createWorkflowClient()
    const err = await transport.request({
      method: 'POST',
      path: '/v1/deals',
      body: { name: 'Bad Deal', value: '1e21' },
    }).catch((caught: unknown) => caught)

    expect(err).toBeInstanceOf(OrbitApiError)
    expect(err).toMatchObject<Partial<OrbitApiError>>({
      error: expect.objectContaining({
        code: 'VALIDATION_FAILED',
        doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
        hint: expect.stringContaining('value'),
        retryable: false,
      }),
      status: 400,
    })
    expect((err as OrbitApiError).error.request_id).toMatch(/^req_/)
  })

  it('adds API-shaped metadata defaults to direct-mode OrbitApiError failures', async () => {
    const { transport } = await createWorkflowClient()
    const err = await transport.request({
      method: 'POST',
      path: '/v1/deals/deal_missing/move',
      body: {},
    }).catch((caught: unknown) => caught)

    expect(err).toBeInstanceOf(OrbitApiError)
    expect(err).toMatchObject<Partial<OrbitApiError>>({
      error: expect.objectContaining({
        code: 'VALIDATION_FAILED',
        doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
        retryable: false,
      }),
      status: 400,
    })
    expect((err as OrbitApiError).error.request_id).toMatch(/^req_/)
  })

  it('rejects empty schema migration bodies in direct mode', async () => {
    const { transport } = await createWorkflowClient()

    await expect(
      transport.request({
        method: 'POST',
        path: '/v1/schema/migrations/apply',
      }),
    ).rejects.toMatchObject<Partial<OrbitApiError>>({
      error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      status: 400,
    })
  })

  it('dispatches schema field update/delete routes to typed not-implemented errors', async () => {
    const { client } = await createWorkflowClient()

    await expect(
      client.schema.updateField('contacts', 'linkedin', { label: 'LinkedIn' }),
    ).rejects.toMatchObject<Partial<OrbitApiError>>({
      error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      status: 501,
    })

    await expect(
      client.schema.deleteField('contacts', 'linkedin'),
    ).rejects.toMatchObject<Partial<OrbitApiError>>({
      error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      status: 501,
    })
  })
})
