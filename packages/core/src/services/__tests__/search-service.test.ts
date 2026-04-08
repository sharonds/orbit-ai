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

  it('does not re-apply the text-search query against the merged title/subtitle (M1)', async () => {
    // The repos already filtered by `query.query`. Their results contain
    // records whose match came from a field that only the entity repo
    // searches (here: company.industry). The merged-result pass must NOT
    // filter those records out a second time using only title/subtitle —
    // doing so silently drops legitimate matches.
    const company = {
      id: 'company_01',
      name: 'Northwind',
      domain: null,
      industry: 'aerospace',
      website: null,
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    }
    const service = createSearchService({
      // Mock repo returns the record regardless of query — it has already
      // matched at the entity layer.
      companies: mockRepo([company]) as any,
      contacts: mockRepo([]) as any,
      deals: mockRepo([]) as any,
      pipelines: mockRepo([]) as any,
      stages: mockRepo([]) as any,
      users: mockRepo([]) as any,
    })

    const result = await service.search(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: 'aerospace' },
    )

    // Without the M1 fix, the merged pass would re-run `applySearch` on
    // ['title', 'subtitle']. Neither contains "aerospace" (the title is
    // "Northwind" and the subtitle is null), so the record would be
    // dropped. With the fix, the per-repo match is honored.
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe('company_01')
  })

  it('sorts merged records by emitted updatedAt camelCase field (M2)', async () => {
    // Earlier `defaultSort: 'updated_at'` only worked via implicit
    // toRecordKey conversion. After the M2 fix, the sort spec uses
    // camelCase `updatedAt` directly to match the emitted shape.
    const oldRecord = {
      id: 'company_old',
      name: 'Old Co',
      domain: null,
      industry: null,
      website: null,
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    }
    const newRecord = {
      id: 'company_new',
      name: 'New Co',
      domain: null,
      industry: null,
      website: null,
      updatedAt: new Date('2026-04-08T00:00:00.000Z'),
    }
    const service = createSearchService({
      // Return in old-first order so the desc sort must reorder them.
      companies: mockRepo([oldRecord, newRecord]) as any,
      contacts: mockRepo([]) as any,
      deals: mockRepo([]) as any,
      pipelines: mockRepo([]) as any,
      stages: mockRepo([]) as any,
      users: mockRepo([]) as any,
    })

    const result = await service.search(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: '' },
    )

    expect(result.data.map((r) => r.id)).toEqual(['company_new', 'company_old'])
  })

  it('only fetches requested repos when object_types is specified', async () => {
    const companiesRepo = mockRepo([{ id: 'company_01', name: 'Acme', updatedAt: new Date() }])
    const contactsRepo = mockRepo([{ id: 'contact_01', name: 'Alice', status: 'active', updatedAt: new Date() }])
    const dealsRepo = mockRepo([])
    const pipelinesRepo = mockRepo([])
    const stagesRepo = mockRepo([])
    const usersRepo = mockRepo([])

    const service = createSearchService({
      companies: companiesRepo as any,
      contacts: contactsRepo as any,
      deals: dealsRepo as any,
      pipelines: pipelinesRepo as any,
      stages: stagesRepo as any,
      users: usersRepo as any,
    })

    await service.search(
      { orgId: 'org_test', apiKeyId: 'key_test', scopes: ['*'] },
      { query: '', object_types: ['contacts'] },
    )

    expect(contactsRepo.search).toHaveBeenCalled()
    expect(companiesRepo.search).not.toHaveBeenCalled()
    expect(dealsRepo.search).not.toHaveBeenCalled()
    expect(pipelinesRepo.search).not.toHaveBeenCalled()
    expect(stagesRepo.search).not.toHaveBeenCalled()
    expect(usersRepo.search).not.toHaveBeenCalled()
  })
})
