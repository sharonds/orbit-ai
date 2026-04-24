import { describe, expect, it } from 'vitest'
import { OrbitSchemaEngine } from './engine.js'
import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'
import { OrbitError } from '../types/errors.js'

const ctx: OrbitAuthContext = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY', scopes: ['*'] }

function field(id: string, fieldName: string): CustomFieldDefinitionRecord {
  const now = new Date('2026-04-24T00:00:00.000Z')
  return {
    id,
    organizationId: ctx.orgId,
    entityType: 'contacts',
    fieldName,
    fieldType: 'text',
    label: fieldName,
    description: null,
    isRequired: false,
    isIndexed: false,
    isPromoted: false,
    promotedColumnName: null,
    defaultValue: null,
    options: [],
    validation: {},
    createdAt: now,
    updatedAt: now,
  }
}

describe('OrbitSchemaEngine', () => {
  it('follows repository pagination when listing schema objects', async () => {
    const calls: Array<Record<string, unknown>> = []
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list(_ctx, query) {
        calls.push(query)
        if (query.cursor === undefined) {
          return { data: [field('field_01J00000000000000000000000', 'first')], hasMore: true, nextCursor: 'cursor_2' }
        }
        return { data: [field('field_01J00000000000000000000001', 'second')], hasMore: false, nextCursor: null }
      },
    }

    const result = await new OrbitSchemaEngine(() => repo).listObjects(ctx)
    const contacts = result.find((object) => object.type === 'contacts')

    expect(calls).toEqual([{ limit: 500 }, { limit: 500, cursor: 'cursor_2' }])
    expect(contacts?.customFields.map((customField) => customField.fieldName)).toEqual(['first', 'second'])
  })

  it('throws OrbitError validation failures for invalid custom field input', async () => {
    const repo: CustomFieldDefinitionRepository = {
      async create(_ctx, record) {
        return record
      },
      async get() {
        return null
      },
      async list() {
        return { data: [], hasMore: false, nextCursor: null }
      },
    }

    await expect(new OrbitSchemaEngine(() => repo).addField(ctx, 'contacts', {})).rejects.toBeInstanceOf(OrbitError)
    await expect(new OrbitSchemaEngine(() => repo).addField(ctx, 'contacts', {})).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'name',
    })
  })
})
