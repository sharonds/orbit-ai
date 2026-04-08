import type { CustomFieldDefinition, OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'

/**
 * Object type metadata returned by `GET /v1/objects/:type`.
 *
 * The endpoint returns the registered entity type plus its configured
 * custom fields. Until a registry-driven schema (T10) lands, downstream
 * fields beyond `type` and `customFields` are intentionally typed as
 * `unknown` so consumers do not couple to a shape that may shift.
 */
export interface SchemaObjectDefinition {
  type: string
  customFields: CustomFieldDefinition[]
  [key: string]: unknown
}

/**
 * Migration preview / apply / rollback results. The shape is not yet
 * stabilized — typed as a permissive object so callers can read the
 * documented top-level fields without coupling to internals.
 */
export type SchemaMigrationResult = Record<string, unknown>

export class SchemaResource {
  constructor(private readonly transport: OrbitTransport) {}

  async listObjects(): Promise<SchemaObjectDefinition[]> {
    const r = await this.transport.request<SchemaObjectDefinition[]>({
      method: 'GET',
      path: '/v1/objects',
    })
    return r.data
  }

  async describeObject(type: string): Promise<SchemaObjectDefinition> {
    const r = await this.transport.request<SchemaObjectDefinition>({
      method: 'GET',
      path: `/v1/objects/${type}`,
    })
    return r.data
  }

  async addField(type: string, body: Record<string, unknown>): Promise<CustomFieldDefinition> {
    const r = await this.transport.request<CustomFieldDefinition>({
      method: 'POST',
      path: `/v1/objects/${type}/fields`,
      body,
    })
    return r.data
  }

  async updateField(
    type: string,
    fieldName: string,
    body: Record<string, unknown>,
  ): Promise<CustomFieldDefinition> {
    const r = await this.transport.request<CustomFieldDefinition>({
      method: 'PATCH',
      path: `/v1/objects/${type}/fields/${fieldName}`,
      body,
    })
    return r.data
  }

  async deleteField(type: string, fieldName: string): Promise<{ id: string; deleted: true }> {
    const r = await this.transport.request<{ id: string; deleted: true }>({
      method: 'DELETE',
      path: `/v1/objects/${type}/fields/${fieldName}`,
    })
    return r.data
  }

  async previewMigration(body: Record<string, unknown>): Promise<SchemaMigrationResult> {
    const r = await this.transport.request<SchemaMigrationResult>({
      method: 'POST',
      path: '/v1/schema/migrations/preview',
      body,
    })
    return r.data
  }

  async applyMigration(body: Record<string, unknown>): Promise<SchemaMigrationResult> {
    const r = await this.transport.request<SchemaMigrationResult>({
      method: 'POST',
      path: '/v1/schema/migrations/apply',
      body,
    })
    return r.data
  }

  async rollbackMigration(id: string): Promise<SchemaMigrationResult> {
    const r = await this.transport.request<SchemaMigrationResult>({
      method: 'POST',
      path: `/v1/schema/migrations/${id}/rollback`,
    })
    return r.data
  }

  response(): {
    listObjects: () => Promise<OrbitEnvelope<SchemaObjectDefinition[]>>
    describeObject: (type: string) => Promise<OrbitEnvelope<SchemaObjectDefinition>>
    addField: (type: string, body: Record<string, unknown>) => Promise<OrbitEnvelope<CustomFieldDefinition>>
    updateField: (
      type: string,
      fieldName: string,
      body: Record<string, unknown>,
    ) => Promise<OrbitEnvelope<CustomFieldDefinition>>
    deleteField: (
      type: string,
      fieldName: string,
    ) => Promise<OrbitEnvelope<{ id: string; deleted: true }>>
    previewMigration: (body: Record<string, unknown>) => Promise<OrbitEnvelope<SchemaMigrationResult>>
    applyMigration: (body: Record<string, unknown>) => Promise<OrbitEnvelope<SchemaMigrationResult>>
    rollbackMigration: (id: string) => Promise<OrbitEnvelope<SchemaMigrationResult>>
  } {
    return {
      listObjects: () =>
        this.transport.rawRequest<SchemaObjectDefinition[]>({ method: 'GET', path: '/v1/objects' }),
      describeObject: (type) =>
        this.transport.rawRequest<SchemaObjectDefinition>({
          method: 'GET',
          path: `/v1/objects/${type}`,
        }),
      addField: (type, body) =>
        this.transport.rawRequest<CustomFieldDefinition>({
          method: 'POST',
          path: `/v1/objects/${type}/fields`,
          body,
        }),
      updateField: (type, fieldName, body) =>
        this.transport.rawRequest<CustomFieldDefinition>({
          method: 'PATCH',
          path: `/v1/objects/${type}/fields/${fieldName}`,
          body,
        }),
      deleteField: (type, fieldName) =>
        this.transport.rawRequest<{ id: string; deleted: true }>({
          method: 'DELETE',
          path: `/v1/objects/${type}/fields/${fieldName}`,
        }),
      previewMigration: (body) =>
        this.transport.rawRequest<SchemaMigrationResult>({
          method: 'POST',
          path: '/v1/schema/migrations/preview',
          body,
        }),
      applyMigration: (body) =>
        this.transport.rawRequest<SchemaMigrationResult>({
          method: 'POST',
          path: '/v1/schema/migrations/apply',
          body,
        }),
      rollbackMigration: (id) =>
        this.transport.rawRequest<SchemaMigrationResult>({
          method: 'POST',
          path: `/v1/schema/migrations/${id}/rollback`,
        }),
    }
  }
}
