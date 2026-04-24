import { generateId } from '../ids/generate-id.js'
import { assertOrgContext } from '../services/service-helpers.js'
import { createOrbitError } from '../types/errors.js'
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

const ALLOWED_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone', 'currency', 'relation'] as const

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

  private async listAllCustomFields(
    ctx: OrbitAuthContext,
    filter?: Record<string, unknown>,
  ): Promise<CustomFieldDefinitionRecord[]> {
    const fields: CustomFieldDefinitionRecord[] = []
    let cursor: string | undefined

    do {
      const result = await this.repository.list(ctx, {
        limit: 500,
        ...(cursor ? { cursor } : {}),
        ...(filter ? { filter } : {}),
      })
      fields.push(...result.data)
      cursor = result.nextCursor ?? undefined
    } while (cursor)

    return fields
  }

  private validationFailed(message: string, field: string): never {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message,
      field,
    })
  }

  async listObjects(ctx: OrbitAuthContext): Promise<SchemaObjectSummary[]> {
    const allFields = await this.listAllCustomFields(ctx)

    return PUBLIC_CRM_ENTITY_TYPES.map((type) => ({
      type,
      customFields: allFields.filter((f) => f.entityType === type),
    }))
  }

  async getObject(ctx: OrbitAuthContext, type: string): Promise<SchemaObjectSummary | null> {
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(type as PublicCrmEntityType)) {
      return null
    }
    const customFields = await this.listAllCustomFields(ctx, { entity_type: type })
    return { type, customFields }
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
      this.validationFailed('Field name is required', 'name')
    }
    if (!type || typeof type !== 'string') {
      this.validationFailed('Field type is required', 'type')
    }
    if (!ALLOWED_FIELD_TYPES.includes(type as typeof ALLOWED_FIELD_TYPES[number])) {
      this.validationFailed(`Unknown field type: ${type}. Allowed: ${ALLOWED_FIELD_TYPES.join(', ')}`, 'type')
    }
    if (!PUBLIC_CRM_ENTITY_TYPES.includes(entityType as PublicCrmEntityType)) {
      this.validationFailed(`Unknown entity type: ${entityType}`, 'entityType')
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
