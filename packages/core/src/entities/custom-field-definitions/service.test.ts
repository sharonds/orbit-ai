import { describe, expect, it } from 'vitest'

import { generateId } from '../../ids/generate-id.js'
import { createInMemoryCustomFieldDefinitionRepository } from './repository.js'
import { createCustomFieldDefinitionAdminService } from './service.js'
import type { CustomFieldDefinitionRecord } from './validators.js'
import { customFieldDefinitionRecordSchema } from './validators.js'

const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' } as const
const ctxB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' } as const

function makeRecord(overrides: Partial<CustomFieldDefinitionRecord> = {}): CustomFieldDefinitionRecord {
  return {
    id: generateId('customField'),
    organizationId: ctx.orgId,
    entityType: 'contacts',
    fieldName: 'priority',
    fieldType: 'select',
    label: 'Priority',
    description: 'Contact priority level',
    isRequired: false,
    isIndexed: false,
    isPromoted: false,
    promotedColumnName: null,
    defaultValue: null,
    options: ['low', 'medium', 'high'],
    validation: {},
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    ...overrides,
  }
}

describe('customFieldDefinition service', () => {
  it('lists custom field definitions within org scope', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)

    const record = makeRecord()
    await repo.create(ctx, record)

    const result = await service.list(ctx, { limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe(record.id)
    expect(result.data[0]?.organizationId).toBe(ctx.orgId)
  })

  it('gets a single custom field definition by id', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)

    const record = makeRecord()
    await repo.create(ctx, record)

    const found = await service.get(ctx, record.id)
    expect(found).not.toBeNull()
    expect(found?.id).toBe(record.id)
    expect(found?.fieldName).toBe('priority')
  })

  it('tenant isolation: org B cannot see org A custom field definitions', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)

    const record = makeRecord()
    await repo.create(ctx, record)

    const found = await service.get(ctxB, record.id)
    expect(found).toBeNull()

    const list = await service.list(ctxB, { limit: 10 })
    expect(list.data).toHaveLength(0)
  })

  it('rejects duplicate (organizationId, entityType, fieldName) with CONFLICT', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()

    const record1 = makeRecord()
    await repo.create(ctx, record1)

    const record2 = makeRecord({ id: generateId('customField') })
    await expect(repo.create(ctx, record2)).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'fieldName',
    })
  })

  it('allows same fieldName for different entityTypes', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()

    const record1 = makeRecord({ entityType: 'contacts' })
    const record2 = makeRecord({ id: generateId('customField'), entityType: 'companies' })

    await expect(repo.create(ctx, record1)).resolves.toBeDefined()
    await expect(repo.create(ctx, record2)).resolves.toBeDefined()
  })

  it('validates fieldType against the CustomFieldType union — throws on invalid type', async () => {
    expect(() =>
      customFieldDefinitionRecordSchema.parse(
        makeRecord({ fieldType: 'invalid_type' as never }),
      ),
    ).toThrow()
  })

  it('round-trips JSON metadata fields (options, validation, defaultValue)', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)

    const record = makeRecord({
      options: ['low', 'medium', 'high'],
      validation: { min: 1, max: 100 },
      defaultValue: 'medium',
    })
    await repo.create(ctx, record)

    const found = await service.get(ctx, record.id)
    expect(found?.options).toEqual(['low', 'medium', 'high'])
    expect(found?.validation).toEqual({ min: 1, max: 100 })
    expect(found?.defaultValue).toBe('medium')
  })

  it('preserves all canonical persisted fields (isRequired, isIndexed, isPromoted, promotedColumnName)', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)

    const record = makeRecord({
      isRequired: true,
      isIndexed: true,
      isPromoted: true,
      promotedColumnName: 'promoted_priority',
    })
    await repo.create(ctx, record)

    const found = await service.get(ctx, record.id)
    expect(found?.isRequired).toBe(true)
    expect(found?.isIndexed).toBe(true)
    expect(found?.isPromoted).toBe(true)
    expect(found?.promotedColumnName).toBe('promoted_priority')
  })

  it('updates safe metadata while preserving field identity and values', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)
    const record = makeRecord({ defaultValue: 'medium' })
    await repo.create(ctx, record)

    const updated = await service.update(ctx, record.id, {
      label: 'Priority segment',
      description: 'Updated description',
      updatedAt: new Date('2026-04-03T12:00:00.000Z'),
    })

    expect(updated).toMatchObject({
      id: record.id,
      organizationId: ctx.orgId,
      entityType: 'contacts',
      fieldName: 'priority',
      fieldType: 'select',
      label: 'Priority segment',
      description: 'Updated description',
      defaultValue: 'medium',
      options: ['low', 'medium', 'high'],
    })
  })

  it('rejects update conflicts within the same org and entity only', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const priority = makeRecord({ fieldName: 'priority' })
    const tier = makeRecord({ id: generateId('customField'), fieldName: 'tier' })
    const betaPriority = makeRecord({
      id: generateId('customField'),
      organizationId: ctxB.orgId,
      fieldName: 'priority',
    })
    await repo.create(ctx, priority)
    await repo.create(ctx, tier)
    await repo.create(ctxB, betaPriority)

    await expect(repo.update(ctx, tier.id, { fieldName: 'priority' })).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'fieldName',
    })
    await expect(repo.update(ctxB, betaPriority.id, { label: 'Beta priority' })).resolves.toMatchObject({
      organizationId: ctxB.orgId,
      fieldName: 'priority',
      label: 'Beta priority',
    })
  })

  it('deletes only the matching org-scoped custom field definition', async () => {
    const repo = createInMemoryCustomFieldDefinitionRepository()
    const service = createCustomFieldDefinitionAdminService(repo)
    const record = makeRecord()
    const betaRecord = makeRecord({ id: generateId('customField'), organizationId: ctxB.orgId })
    await repo.create(ctx, record)
    await repo.create(ctxB, betaRecord)

    await expect(service.delete(ctxB, record.id)).resolves.toBe(false)
    await expect(service.delete(ctx, record.id)).resolves.toBe(true)
    await expect(repo.get(ctx, record.id)).resolves.toBeNull()
    await expect(repo.get(ctxB, betaRecord.id)).resolves.toMatchObject({ id: betaRecord.id })
  })
})
