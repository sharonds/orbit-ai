import { describe, it, expect } from 'vitest'
import { generateOpenApiSpec } from '../openapi/generator.js'
import { BASE_ENTITIES } from '../openapi/entities.js'

describe('OpenAPI spec', () => {
  const spec = generateOpenApiSpec({ title: 'Orbit AI', version: '2026-04-01' }) as any

  it('does not include pipeline_stages or channels as entities', () => {
    expect(BASE_ENTITIES).not.toContain('pipeline_stages')
    expect(BASE_ENTITIES).not.toContain('channels')
  })

  it('includes pipelines, stages, and sequence sub-entities', () => {
    expect(BASE_ENTITIES).toContain('pipelines')
    expect(BASE_ENTITIES).toContain('stages')
    expect(BASE_ENTITIES).toContain('sequence_steps')
    expect(BASE_ENTITIES).toContain('sequence_enrollments')
    expect(BASE_ENTITIES).toContain('sequence_events')
  })

  it('models path IDs as string without uuid format', () => {
    const contactGet = spec.paths['/v1/contacts/{id}']?.get
    expect(contactGet).toBeDefined()
    const idParam = contactGet?.parameters?.find((p: any) => p.name === 'id')
    expect(idParam).toBeDefined()
    expect(idParam.schema.format).toBeUndefined()
    expect(idParam.schema.type).toBe('string')
  })

  it('does not double /v1 prefix via servers', () => {
    const serverUrl = spec.servers?.[0]?.url
    expect(serverUrl).not.toContain('/v1')
  })

  it('envelope schema has correct metadata fields', () => {
    const envelope = spec.components.schemas.Envelope
    const metaProps = envelope.properties.meta.properties
    expect(metaProps).toHaveProperty('request_id')
    expect(metaProps).toHaveProperty('version')
    expect(metaProps).toHaveProperty('has_more')
    expect(metaProps).toHaveProperty('next_cursor')
    expect(metaProps).not.toHaveProperty('org_id')
    expect(metaProps).not.toHaveProperty('api_version')
  })
})
