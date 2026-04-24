import { generateId } from '../ids/generate-id.js'
import { assertOrgContext } from '../services/service-helpers.js'
import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import type { CustomFieldDefinitionRecord } from '../entities/custom-field-definitions/validators.js'

/** CRM entity types that appear in the public schema listing. */
const PUBLIC_CRM_ENTITY_TYPES = [
  'contacts',
  'companies',
  'deals',
  'pipelines',
  'stages',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'tags',
  'users',
] as const

export type PublicCrmEntityType = (typeof PUBLIC_CRM_ENTITY_TYPES)[number]

export interface SchemaObjectSummary {
  type: string
  customFields: CustomFieldDefinitionRecord[]
}

export class OrbitSchemaEngine {
  private readonly getRepository: (() => CustomFieldDefinitionRepository) | null

  constructor(getRepository?: () => CustomFieldDefinitionRepository) {
    this.getRepository = getRepository ?? null
  }

  private get repository(): CustomFieldDefinitionRepository {
    if (!this.getRepository) {
      throw new Error('OrbitSchemaEngine: no CustomFieldDefinitionRepository provided')
    }
    return this.getRepository()
  }

  async listObjects(ctx: OrbitAuthContext): Promise<SchemaObjectSummary[]> {
    const result = await this.repository.list(ctx, { limit: 500 })
    const allFields = result.data

    return PUBLIC_CRM_ENTITY_TYPES.map((type) => ({
      type,
      customFields: allFields.filter((f) => f.entityType === type),
    }))
  }

  async getObject(ctx: OrbitAuthContext, type: string): Promise<SchemaObjectSummary | null> {
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(type as PublicCrmEntityType)) {
      return null
    }
    const result = await this.repository.list(ctx, {
      limit: 500,
      filter: { entity_type: type },
    })
    return { type, customFields: result.data }
  }

  async addField(
    ctx: OrbitAuthContext,
    entityType: string,
    body: Record<string, unknown>,
  ): Promise<CustomFieldDefinitionRecord> {
    const orgId = assertOrgContext(ctx)
    const name = body.name as string | undefined
    const type = body.type as string | undefined

    if (!name || typeof name !== 'string') {
      throw Object.assign(new Error('Field name is required'), { code: 'VALIDATION_FAILED' })
    }
    if (!type || typeof type !== 'string') {
      throw Object.assign(new Error('Field type is required'), { code: 'VALIDATION_FAILED' })
    }
    const ALLOWED_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone', 'currency', 'relation'] as const
    if (!ALLOWED_FIELD_TYPES.includes(type as typeof ALLOWED_FIELD_TYPES[number])) {
      throw Object.assign(new Error(`Unknown field type: ${type}. Allowed: ${ALLOWED_FIELD_TYPES.join(', ')}`), { code: 'VALIDATION_FAILED' })
    }
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(entityType as PublicCrmEntityType)) {
      throw Object.assign(new Error(`Unknown entity type: ${entityType}`), { code: 'VALIDATION_FAILED' })
    }

    const now = new Date()
    const record: CustomFieldDefinitionRecord = {
      id: generateId('customField'),
      organizationId: orgId,
      entityType,
      fieldName: name,
      fieldType: type as CustomFieldDefinitionRecord['fieldType'],
      label: (body.label as string | undefined) ?? name,
      description: (body.description as string | undefined) ?? null,
      isRequired: (body.required as boolean | undefined) ?? false,
      isIndexed: false,
      isPromoted: false,
      promotedColumnName: null,
      defaultValue: null,
      options: [],
      validation: {},
      createdAt: now,
      updatedAt: now,
    }

    return this.repository.create(ctx, record)
  }

  async preview(
    ctx: OrbitAuthContext,
    _data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    assertOrgContext(ctx)
    return { operations: [], destructive: false, status: 'ok' }
  }

  async apply(
    ctx: OrbitAuthContext,
    _data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    assertOrgContext(ctx)
    return { applied: [], status: 'ok' }
  }
}
