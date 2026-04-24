import { describe, expect, it } from 'vitest'

import { createInMemoryCompanyRepository } from '../entities/companies/repository.js'
import { createInMemoryContactRepository } from '../entities/contacts/repository.js'
import { createInMemoryDealRepository } from '../entities/deals/repository.js'
import { createInMemoryPipelineRepository } from '../entities/pipelines/repository.js'
import { createInMemoryStageRepository } from '../entities/stages/repository.js'
import { createInMemoryUserRepository } from '../entities/users/repository.js'
import { createSearchService } from './search-service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
}

describe('search service', () => {
  it('paginates across merged results without truncating at the per-entity limit', async () => {
    const companies = Array.from({ length: 101 }, (_value, index) => index + 1)
    const companyRepo = createInMemoryCompanyRepository(
      companies.map((index) => ({
        id: `company_01ARYZ6S41${String(index).padStart(16, 'Y')}`,
        organizationId: ctx.orgId,
        name: `Acme ${String(index).padStart(3, '0')}`,
        domain: `acme-${index}.test`,
        industry: 'Software',
        size: index,
        website: null,
        notes: null,
        assignedToUserId: null,
        customFields: {},
        createdAt: new Date(`2026-03-31T10:${String(index % 60).padStart(2, '0')}:00.000Z`),
        updatedAt: new Date(`2026-03-31T10:${String(index % 60).padStart(2, '0')}:00.000Z`),
      })),
    )

    const service = createSearchService({
      companies: companyRepo,
      contacts: createInMemoryContactRepository(),
      deals: createInMemoryDealRepository(),
      pipelines: createInMemoryPipelineRepository(),
      stages: createInMemoryStageRepository(),
      users: createInMemoryUserRepository(),
    })

    const firstPage = await service.search(ctx, { query: 'Acme', limit: 100 })
    const secondPage = await service.search(ctx, { query: 'Acme', limit: 100, cursor: firstPage.nextCursor ?? undefined })

    expect(firstPage.data).toHaveLength(100)
    expect(firstPage.hasMore).toBe(true)
    expect(secondPage.data).toHaveLength(1)
    expect(secondPage.hasMore).toBe(false)
  })

  it('returns sanitized record summaries instead of raw entity objects', async () => {
    const userRepo = createInMemoryUserRepository([
      {
        id: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: ctx.orgId,
        email: 'jane@example.com',
        name: 'Jane',
        role: 'admin',
        avatarUrl: null,
        externalAuthId: 'auth-secret',
        isActive: true,
        metadata: { internal: true },
        createdAt: new Date('2026-03-31T11:00:00.000Z'),
        updatedAt: new Date('2026-03-31T11:00:00.000Z'),
      },
    ])

    const sanitizedService = createSearchService({
      companies: createInMemoryCompanyRepository(),
      contacts: createInMemoryContactRepository(),
      deals: createInMemoryDealRepository(),
      pipelines: createInMemoryPipelineRepository(),
      stages: createInMemoryStageRepository(),
      users: userRepo,
    })

    const result = await sanitizedService.search(ctx, { query: 'Jane', limit: 10 })
    const record = result.data[0]?.record ?? {}

    expect(record).toMatchObject({
      id: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      name: 'Jane',
      email: 'jane@example.com',
      role: 'admin',
      isActive: true,
    })
    expect(record).not.toHaveProperty('externalAuthId')
    expect(record).not.toHaveProperty('metadata')
    expect(record).not.toHaveProperty('keyHash')
  })

  it('does not expose strip-listed stage fields in merged search results', async () => {
    const stageRepo = createInMemoryStageRepository([
      {
        id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: ctx.orgId,
        pipelineId: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Qualified',
        stageOrder: 1,
        probability: 25,
        color: '#ff00ff',
        isWon: false,
        isLost: false,
        createdAt: new Date('2026-03-31T12:00:00.000Z'),
        updatedAt: new Date('2026-03-31T12:00:00.000Z'),
      },
    ])

    const sanitizedService = createSearchService({
      companies: createInMemoryCompanyRepository(),
      contacts: createInMemoryContactRepository(),
      deals: createInMemoryDealRepository(),
      pipelines: createInMemoryPipelineRepository(),
      stages: stageRepo,
      users: createInMemoryUserRepository(),
    })

    const result = await sanitizedService.search(ctx, { query: 'Qualified', limit: 10, object_types: ['stages'] })
    const row = result.data[0]

    expect(row).toMatchObject({
      objectType: 'stage',
      title: 'Qualified',
      subtitle: null,
      record: {
        id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Qualified',
        pipelineId: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
        stageOrder: 1,
      },
    })
    expect(row?.record).not.toHaveProperty('color')
    expect(row?.record).not.toHaveProperty('probability')
    expect(row?.record).not.toHaveProperty('isWon')
    expect(row?.record).not.toHaveProperty('isLost')
    expect(row?.subtitle).not.toBe('#ff00ff')
  })
})
