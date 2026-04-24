import { describe, it, expect } from 'vitest'
import { camelToSnake, snakeToCamel, serializeEntityRecord, deserializeEntityInput } from '../serialization.js'

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
    expect(camelToSnake('status')).toBe('status')
  })
})

describe('snakeToCamel', () => {
  it('converts snake_case to camelCase', () => {
    expect(snakeToCamel('organization_id')).toBe('organizationId')
    expect(snakeToCamel('stage_id')).toBe('stageId')
    expect(snakeToCamel('created_at')).toBe('createdAt')
    expect(snakeToCamel('custom_fields')).toBe('customFields')
  })

  it('leaves already-camelCase strings unchanged', () => {
    expect(snakeToCamel('id')).toBe('id')
    expect(snakeToCamel('name')).toBe('name')
  })
})

describe('serializeEntityRecord', () => {
  it('converts camelCase keys to snake_case', () => {
    const result = serializeEntityRecord('contacts', {
      id: 'cnt_1',
      organizationId: 'org_1',
      name: 'Alice',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    })

    expect(result).toMatchObject({
      object: 'contact',
      id: 'cnt_1',
      organization_id: 'org_1',
      name: 'Alice',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })
  })

  it('injects the object discriminator', () => {
    expect(serializeEntityRecord('deals', { id: 'deal_1' })).toMatchObject({ object: 'deal' })
    expect(serializeEntityRecord('stages', { id: 'stg_1' })).toMatchObject({ object: 'stage' })
    expect(serializeEntityRecord('pipelines', { id: 'pip_1' })).toMatchObject({ object: 'pipeline' })
  })

  it('renames deal.title → name', () => {
    const result = serializeEntityRecord('deals', {
      id: 'deal_1',
      organizationId: 'org_1',
      title: 'Big Sale',
      stageId: 'stg_1',
      pipelineId: 'pip_1',
      status: 'open',
    })

    expect(result).toMatchObject({
      object: 'deal',
      name: 'Big Sale',
      stage_id: 'stg_1',
      pipeline_id: 'pip_1',
    })
    expect(result).not.toHaveProperty('title')
  })

  it('renames stage.stageOrder → position', () => {
    const result = serializeEntityRecord('stages', {
      id: 'stg_1',
      organizationId: 'org_1',
      pipelineId: 'pip_1',
      name: 'Qualified',
      stageOrder: 2,
    })

    expect(result).toMatchObject({
      object: 'stage',
      position: 2,
      pipeline_id: 'pip_1',
    })
    expect(result).not.toHaveProperty('stageOrder')
    expect(result).not.toHaveProperty('stage_order')
  })

  it('renames note.content → body and createdByUserId → user_id', () => {
    const result = serializeEntityRecord('notes', {
      id: 'note_1',
      organizationId: 'org_1',
      content: 'Follow up required',
      createdByUserId: 'usr_1',
    })

    expect(result).toMatchObject({
      object: 'note',
      body: 'Follow up required',
      user_id: 'usr_1',
    })
    expect(result).not.toHaveProperty('content')
    expect(result).not.toHaveProperty('createdByUserId')
  })

  it('strips deal internal fields (wonAt, lostAt, lostReason, probability)', () => {
    const result = serializeEntityRecord('deals', {
      id: 'deal_1',
      title: 'Test',
      wonAt: new Date(),
      lostAt: new Date(),
      lostReason: 'lost',
      probability: 50,
    })

    expect(result).not.toHaveProperty('wonAt')
    expect(result).not.toHaveProperty('won_at')
    expect(result).not.toHaveProperty('lostAt')
    expect(result).not.toHaveProperty('lostReason')
    expect(result).not.toHaveProperty('probability')
  })

  it('strips stage internal fields (probability, color, isWon, isLost)', () => {
    const result = serializeEntityRecord('stages', {
      id: 'stg_1',
      name: 'Won',
      probability: 100,
      color: '#green',
      isWon: true,
      isLost: false,
    })

    expect(result).not.toHaveProperty('probability')
    expect(result).not.toHaveProperty('color')
    expect(result).not.toHaveProperty('isWon')
    expect(result).not.toHaveProperty('isLost')
  })

  it('strips underscore-prefixed internal fields', () => {
    const result = serializeEntityRecord('contacts', {
      id: 'cnt_1',
      name: 'Bob',
      _internalFlag: true,
    })

    expect(result).not.toHaveProperty('_internalFlag')
    expect(result).toMatchObject({ id: 'cnt_1', name: 'Bob' })
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
      id: 'wh_1',
      organization_id: 'org_1',
      url: 'https://example.com/hook',
      signing_secret_last_four: 'abcd',
      signing_secret_created_at: '2026-01-01T00:00:00.000Z',
    })
    expect(result).not.toHaveProperty('secretEncrypted')
    expect(result).not.toHaveProperty('secret_encrypted')
    expect(result).not.toHaveProperty('secretLastFour')
    expect(result).not.toHaveProperty('secret_last_four')
    expect(result).not.toHaveProperty('secretCreatedAt')
    expect(result).not.toHaveProperty('secret_created_at')
  })
})

describe('deserializeEntityInput', () => {
  it('converts snake_case keys to camelCase', () => {
    const result = deserializeEntityInput('contacts', {
      name: 'Alice',
      source_channel: 'email',
      company_id: 'co_1',
      assigned_to_user_id: 'usr_1',
      custom_fields: { tier: 'gold' },
    })

    expect(result).toMatchObject({
      name: 'Alice',
      sourceChannel: 'email',
      companyId: 'co_1',
      assignedToUserId: 'usr_1',
      customFields: { tier: 'gold' },
    })
  })

  it('renames deal name → title', () => {
    const result = deserializeEntityInput('deals', {
      name: 'Big Sale',
      stage_id: 'stg_1',
      pipeline_id: 'pip_1',
    })

    expect(result).toMatchObject({
      title: 'Big Sale',
      stageId: 'stg_1',
      pipelineId: 'pip_1',
    })
    expect(result).not.toHaveProperty('name')
  })

  it('renames stage position → stageOrder', () => {
    const result = deserializeEntityInput('stages', {
      pipeline_id: 'pip_1',
      name: 'Prospecting',
      position: 1,
    })

    expect(result).toMatchObject({
      pipelineId: 'pip_1',
      name: 'Prospecting',
      stageOrder: 1,
    })
    expect(result).not.toHaveProperty('position')
  })

  it('renames note body → content and user_id → createdByUserId', () => {
    const result = deserializeEntityInput('notes', {
      body: 'Callback scheduled',
      user_id: 'usr_1',
      contact_id: 'cnt_1',
    })

    expect(result).toMatchObject({
      content: 'Callback scheduled',
      createdByUserId: 'usr_1',
      contactId: 'cnt_1',
    })
    expect(result).not.toHaveProperty('body')
    expect(result).not.toHaveProperty('userId')
  })

  it('handles move-deal body (stage_id → stageId)', () => {
    const result = deserializeEntityInput('deals', { stage_id: 'stg_new' })
    expect(result).toEqual({ stageId: 'stg_new' })
  })

  it('passes through unknown entities without change (camelCase conversion only)', () => {
    const result = deserializeEntityInput('unknown_entity', {
      foo_bar: 'baz',
      some_id: '123',
    })
    expect(result).toEqual({ fooBar: 'baz', someId: '123' })
  })
})
