import type { OrbitTransport } from '../transport/index.js'

export class SchemaResource {
  constructor(private readonly transport: OrbitTransport) {}

  async listObjects() {
    const r = await this.transport.request({ method: 'GET', path: '/v1/objects' })
    return r.data
  }

  async describeObject(type: string) {
    const r = await this.transport.request({ method: 'GET', path: `/v1/objects/${type}` })
    return r.data
  }

  async addField(type: string, body: Record<string, unknown>) {
    const r = await this.transport.request({ method: 'POST', path: `/v1/objects/${type}/fields`, body })
    return r.data
  }

  async updateField(type: string, fieldName: string, body: Record<string, unknown>) {
    const r = await this.transport.request({ method: 'PATCH', path: `/v1/objects/${type}/fields/${fieldName}`, body })
    return r.data
  }

  async deleteField(type: string, fieldName: string) {
    const r = await this.transport.request({ method: 'DELETE', path: `/v1/objects/${type}/fields/${fieldName}` })
    return r.data
  }

  async previewMigration(body: Record<string, unknown>) {
    const r = await this.transport.request({ method: 'POST', path: '/v1/schema/migrations/preview', body })
    return r.data
  }

  async applyMigration(body: Record<string, unknown>) {
    const r = await this.transport.request({ method: 'POST', path: '/v1/schema/migrations/apply', body })
    return r.data
  }

  async rollbackMigration(id: string) {
    const r = await this.transport.request({ method: 'POST', path: `/v1/schema/migrations/${id}/rollback` })
    return r.data
  }

  response() {
    return {
      listObjects: () => this.transport.rawRequest({ method: 'GET', path: '/v1/objects' }),
      describeObject: (type: string) => this.transport.rawRequest({ method: 'GET', path: `/v1/objects/${type}` }),
      addField: (type: string, body: Record<string, unknown>) => this.transport.rawRequest({ method: 'POST', path: `/v1/objects/${type}/fields`, body }),
      updateField: (type: string, fieldName: string, body: Record<string, unknown>) => this.transport.rawRequest({ method: 'PATCH', path: `/v1/objects/${type}/fields/${fieldName}`, body }),
      deleteField: (type: string, fieldName: string) => this.transport.rawRequest({ method: 'DELETE', path: `/v1/objects/${type}/fields/${fieldName}` }),
      previewMigration: (body: Record<string, unknown>) => this.transport.rawRequest({ method: 'POST', path: '/v1/schema/migrations/preview', body }),
      applyMigration: (body: Record<string, unknown>) => this.transport.rawRequest({ method: 'POST', path: '/v1/schema/migrations/apply', body }),
      rollbackMigration: (id: string) => this.transport.rawRequest({ method: 'POST', path: `/v1/schema/migrations/${id}/rollback` }),
    }
  }
}
