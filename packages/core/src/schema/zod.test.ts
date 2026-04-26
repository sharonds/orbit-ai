import { describe, expect, it } from 'vitest'

import {
  auditLogInsertSchema,
  customFieldDefinitionInsertSchema,
  dealInsertSchema,
  idempotencyKeyInsertSchema,
  schemaMigrationInsertSchema,
  stageInsertSchema,
} from './zod.js'

describe('slice 2 zod schemas', () => {
  it('rejects stages that are both won and lost', () => {
    expect(() =>
      stageInsertSchema.parse({
        id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        pipelineId: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Closed',
        stageOrder: 1,
        probability: 100,
        isWon: true,
        isLost: true,
      }),
    ).toThrow('Stage cannot be both won and lost')
  })

  it('rejects wonAt when the deal status is not won', () => {
    expect(() =>
      dealInsertSchema.parse({
        id: 'deal_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        title: 'Expansion Deal',
        currency: 'usd',
        status: 'open',
        wonAt: new Date('2026-03-31T10:00:00.000Z'),
      }),
    ).toThrow('Deal wonAt requires a won status in slice 2')
  })

  it('normalizes currency codes to uppercase on accepted deals', () => {
    const parsed = dealInsertSchema.parse({
      id: 'deal_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      title: 'Expansion Deal',
      currency: 'usd',
      status: 'won',
      wonAt: new Date('2026-03-31T10:00:00.000Z'),
    })

    expect(parsed.currency).toBe('USD')
  })

  it('parses slice E custom field definitions with nullable JSON metadata', () => {
    const parsed = customFieldDefinitionInsertSchema.parse({
      id: 'field_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      entityType: 'contacts',
      fieldName: 'tier',
      fieldType: 'text',
      label: 'Tier',
      description: null,
      isRequired: false,
      isIndexed: true,
      isPromoted: false,
      promotedColumnName: null,
      defaultValue: null,
      options: ['enterprise', 'growth'],
      validation: { maxLength: 32 },
    })

    expect(parsed.defaultValue).toBeNull()
    expect(parsed.options).toEqual(['enterprise', 'growth'])
    expect(parsed.validation).toEqual({ maxLength: 32 })
  })

  it('parses slice E audit logs with nullable actor references and occurredAt', () => {
    const occurredAt = new Date('2026-04-02T12:30:00.000Z')
    const parsed = auditLogInsertSchema.parse({
      id: 'audit_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      actorUserId: null,
      actorApiKeyId: null,
      entityType: 'contacts',
      entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      action: 'updated',
      before: { name: 'Old Name' },
      after: { name: 'New Name' },
      requestId: null,
      metadata: { source: 'api' },
      occurredAt,
    })

    expect(parsed.actorUserId).toBeNull()
    expect(parsed.actorApiKeyId).toBeNull()
    expect(parsed.before).toEqual({ name: 'Old Name' })
    expect(parsed.after).toEqual({ name: 'New Name' })
    expect(parsed.occurredAt).toEqual(occurredAt)
  })

  it('parses slice E schema migrations with nullable entity references and SQL arrays', () => {
    const appliedAt = new Date('2026-04-02T13:00:00.000Z')
    const parsed = schemaMigrationInsertSchema.parse({
      id: 'migration_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      checksum: 'a'.repeat(64),
      adapter: { name: 'sqlite', dialect: 'sqlite' },
      description: 'Add tier field',
      entityType: null,
      operationType: 'add_column',
      forwardOperations: [{
        type: 'custom_field.add',
        entityType: 'contacts',
        fieldName: 'tier',
        fieldType: 'text',
      }],
      reverseOperations: [{
        type: 'custom_field.delete',
        entityType: 'contacts',
        fieldName: 'tier',
      }],
      destructive: false,
      status: 'applied',
      sqlStatements: ['alter table contacts add column tier text'],
      rollbackStatements: ['alter table contacts drop column tier'],
      appliedBy: null,
      appliedByUserId: null,
      approvedByUserId: null,
      startedAt: appliedAt,
      appliedAt,
      rolledBackAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    })

    expect(parsed.entityType).toBeNull()
    expect(parsed.checksum).toBe('a'.repeat(64))
    expect(parsed.adapter).toEqual({ name: 'sqlite', dialect: 'sqlite' })
    expect(parsed.forwardOperations).toHaveLength(1)
    expect(parsed.reverseOperations).toHaveLength(1)
    expect(parsed.status).toBe('applied')
    expect(parsed.sqlStatements).toEqual(['alter table contacts add column tier text'])
    expect(parsed.rollbackStatements).toEqual(['alter table contacts drop column tier'])
    expect(parsed.appliedAt).toEqual(appliedAt)
  })

  it('parses slice E idempotency keys with nullable responseBody and lifecycle dates', () => {
    const completedAt = new Date('2026-04-02T14:00:00.000Z')
    const parsed = idempotencyKeyInsertSchema.parse({
      id: 'idem_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      key: 'idem_123',
      method: 'POST',
      path: '/v1/contacts',
      requestHash: 'sha256:test',
      responseCode: 201,
      responseBody: null,
      lockedUntil: null,
      completedAt,
    })

    expect(parsed.responseBody).toBeNull()
    expect(parsed.lockedUntil).toBeNull()
    expect(parsed.completedAt).toEqual(completedAt)
  })
})
