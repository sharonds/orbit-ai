import { describe, it, expect } from 'vitest'
import {
  camelToSnake,
  snakeToCamel,
  serializeEntityRecord,
  deserializeEntityInput,
} from '../transport/serialization.js'

describe('camelToSnake', () => {
  it('converts camelCase to snake_case', () => {
    expect(camelToSnake('organizationId')).toBe('organization_id')
    expect(camelToSnake('stageId')).toBe('stage_id')
    expect(camelToSnake('createdAt')).toBe('created_at')
    expect(camelToSnake('customFields')).toBe('custom_fields')
  })

  it('leaves already-snake_case strings unchanged', () => {
    expect(camelToSnake('id')).toBe('id')
    expect(camelToSnake('name')).toBe('name')
  })
})

describe('snakeToCamel', () => {
  it('converts snake_case to camelCase', () => {
    expect(snakeToCamel('organization_id')).toBe('organizationId')
    expect(snakeToCamel('stage_id')).toBe('stageId')
    expect(snakeToCamel('created_at')).toBe('createdAt')
  })

  it('leaves already-camelCase strings unchanged', () => {
    expect(snakeToCamel('id')).toBe('id')
    expect(snakeToCamel('name')).toBe('name')
  })
})

describe('serializeEntityRecord (SDK)', () => {
  it('converts camelCase keys to snake_case with object discriminator', () => {
    const result = serializeEntityRecord('contacts', {
      id: 'cnt_1',
      organizationId: 'org_1',
      name: 'Alice',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    expect(result).toMatchObject({
      object: 'contact',
      id: 'cnt_1',
      organization_id: 'org_1',
      name: 'Alice',
      created_at: '2026-01-01T00:00:00.000Z',
    })
  })

  it('renames deal title → name', () => {
    const result = serializeEntityRecord('deals', {
      id: 'deal_1',
      title: 'Big Sale',
      stageId: 'stg_1',
    })

    expect(result).toMatchObject({ object: 'deal', name: 'Big Sale', stage_id: 'stg_1' })
    expect(result).not.toHaveProperty('title')
  })

  it('renames stage stageOrder → position', () => {
    const result = serializeEntityRecord('stages', {
      id: 'stg_1',
      stageOrder: 2,
      pipelineId: 'pip_1',
    })

    expect(result).toMatchObject({ object: 'stage', position: 2, pipeline_id: 'pip_1' })
    expect(result).not.toHaveProperty('stageOrder')
    expect(result).not.toHaveProperty('stage_order')
  })

  it('strips deal internal fields', () => {
    const result = serializeEntityRecord('deals', {
      id: 'deal_1',
      title: 'Test',
      wonAt: new Date(),
      lostAt: new Date(),
      probability: 50,
    })

    expect(result).not.toHaveProperty('won_at')
    expect(result).not.toHaveProperty('wonAt')
    expect(result).not.toHaveProperty('probability')
  })

  it('strips webhook secretEncrypted and renames signing-secret fields', () => {
    const result = serializeEntityRecord('webhooks', {
      id: 'wh_1',
      organizationId: 'org_1',
      url: 'https://example.com/hook',
      events: ['contact.created'],
      status: 'active',
      secretEncrypted: 'SENSITIVE',
      secretLastFour: 'abcd',
      secretCreatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      object: 'webhook',
      organization_id: 'org_1',
      signing_secret_last_four: 'abcd',
      signing_secret_created_at: '2026-01-01T00:00:00.000Z',
    })
    expect(result).not.toHaveProperty('secretEncrypted')
    expect(result).not.toHaveProperty('secret_encrypted')
    expect(result).not.toHaveProperty('secretLastFour')
    expect(result).not.toHaveProperty('secret_last_four')
  })

  it('serializes Date values to ISO strings', () => {
    const d = new Date('2026-06-15T12:00:00.000Z')
    const result = serializeEntityRecord('contacts', { createdAt: d })
    expect(result.created_at).toBe('2026-06-15T12:00:00.000Z')
  })

  it('preserves null values', () => {
    const result = serializeEntityRecord('deals', {
      id: 'deal_1',
      title: 'Test',
      stageId: null,
      pipelineId: null,
    })
    expect(result.stage_id).toBeNull()
    expect(result.pipeline_id).toBeNull()
  })
})

describe('deserializeEntityInput (SDK)', () => {
  it('converts snake_case keys to camelCase', () => {
    const result = deserializeEntityInput('contacts', {
      name: 'Alice',
      source_channel: 'email',
      company_id: 'co_1',
    })

    expect(result).toMatchObject({ name: 'Alice', sourceChannel: 'email', companyId: 'co_1' })
  })

  it('renames deal name → title', () => {
    const result = deserializeEntityInput('deals', {
      name: 'Big Sale',
      stage_id: 'stg_1',
    })

    expect(result).toMatchObject({ title: 'Big Sale', stageId: 'stg_1' })
    expect(result).not.toHaveProperty('name')
  })

  it('renames stage position → stageOrder', () => {
    const result = deserializeEntityInput('stages', { position: 1, pipeline_id: 'pip_1' })
    expect(result).toMatchObject({ stageOrder: 1, pipelineId: 'pip_1' })
    expect(result).not.toHaveProperty('position')
  })
})
