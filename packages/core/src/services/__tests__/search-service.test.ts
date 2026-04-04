import { describe, it, expect, vi } from 'vitest'
import { createSearchService } from '../search-service.js'

function mockRepo(records: any[]) {
  return {
    search: vi.fn(async () => ({ data: records, hasMore: false, nextCursor: null })),
  }
}

describe('SearchService', () => {
  it('filters results by object_types using spec-level plural names', async () => {
    const service = createSearchService({
      companies: mockRepo([{ id: 'company_01', name: 'Acme', updatedAt: new Date() }]) as any,
      contacts: mockRepo([{ id: 'contact_01', name: 'Alice', status: 'active', updatedAt: new Date() }]) as any,
      deals: mockRepo([{ id: 'deal_01', title: 'Big Deal', status: 'open', currency: 'USD', updatedAt: new Date() }]) as any,
      pipelines: mockRepo([]) as any,
      stages: mockRepo([]) as any,
      users: mockRepo([]) as any,
    })
    const result = await service.search(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: '', object_types: ['contacts'] },
    )
    expect(result.data.every((r) => r.objectType === 'contact')).toBe(true)
    expect(result.data.length).toBe(1)
  })

  it('filters multiple object_types', async () => {
    const service = createSearchService({
      companies: mockRepo([{ id: 'company_01', name: 'Acme', updatedAt: new Date() }]) as any,
      contacts: mockRepo([{ id: 'contact_01', name: 'Alice', status: 'active', updatedAt: new Date() }]) as any,
      deals: mockRepo([{ id: 'deal_01', title: 'Big Deal', status: 'open', currency: 'USD', updatedAt: new Date() }]) as any,
      pipelines: mockRepo([]) as any,
      stages: mockRepo([]) as any,
      users: mockRepo([]) as any,
    })
    const result = await service.search(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: '', object_types: ['contacts', 'companies'] },
    )
    const types = new Set(result.data.map((r) => r.objectType))
    expect(types.size).toBe(2)
    expect(types.has('contact')).toBe(true)
    expect(types.has('company')).toBe(true)
  })

  it('returns all types when object_types is omitted', async () => {
    const service = createSearchService({
      companies: mockRepo([{ id: 'company_01', name: 'Acme', updatedAt: new Date() }]) as any,
      contacts: mockRepo([{ id: 'contact_01', name: 'Alice', status: 'active', updatedAt: new Date() }]) as any,
      deals: mockRepo([]) as any,
      pipelines: mockRepo([]) as any,
      stages: mockRepo([]) as any,
      users: mockRepo([]) as any,
    })
    const result = await service.search(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: '' },
    )
    const types = new Set(result.data.map((r) => r.objectType))
    expect(types.has('company')).toBe(true)
    expect(types.has('contact')).toBe(true)
  })
})
