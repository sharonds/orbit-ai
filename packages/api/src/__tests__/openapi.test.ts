import { describe, it, expect } from 'vitest'
import { generateOpenApiSpec } from '../openapi/generator.js'
import { PUBLIC_ENTITY_CAPABILITIES } from '../routes/entity-capabilities.js'

describe('OpenAPI spec', () => {
  const spec = generateOpenApiSpec({ title: 'Orbit AI', version: '2026-04-01' }) as any

  it('does not include pipeline_stages or channels as entities', () => {
    const entityNames = Object.keys(PUBLIC_ENTITY_CAPABILITIES)
    expect(entityNames).not.toContain('pipeline_stages')
    expect(entityNames).not.toContain('channels')
  })

  it('includes pipelines, stages, and sequence sub-entities', () => {
    const entityNames = Object.keys(PUBLIC_ENTITY_CAPABILITIES)
    expect(entityNames).toContain('pipelines')
    expect(entityNames).toContain('stages')
    expect(entityNames).toContain('sequence_steps')
    expect(entityNames).toContain('sequence_enrollments')
    expect(entityNames).toContain('sequence_events')
  })

  it('sequence_events only has read operations (no write)', () => {
    const eventsList = spec.paths['/v1/sequence_events']
    expect(eventsList?.get).toBeDefined()   // list
    expect(eventsList?.post).toBeUndefined() // no create
    const eventsGet = spec.paths['/v1/sequence_events/{id}']
    expect(eventsGet?.get).toBeDefined()     // get
    expect(eventsGet?.patch).toBeUndefined()  // no update
    expect(eventsGet?.delete).toBeUndefined() // no delete
  })

  it('imports uses dedicated route coverage without unsupported update/delete routes', () => {
    const entityNames = Object.keys(PUBLIC_ENTITY_CAPABILITIES)
    expect(entityNames).not.toContain('imports')

    const importsList = spec.paths['/v1/imports']
    expect(importsList?.get).toBeDefined()
    expect(importsList?.post).toBeDefined()

    const importDetail = spec.paths['/v1/imports/{id}']
    expect(importDetail?.get).toBeDefined()
    expect(importDetail?.patch).toBeUndefined()
    expect(importDetail?.delete).toBeUndefined()
  })

  it('webhooks uses dedicated route coverage including deliveries and redelivery', () => {
    const entityNames = Object.keys(PUBLIC_ENTITY_CAPABILITIES)
    expect(entityNames).not.toContain('webhooks')

    const webhooksList = spec.paths['/v1/webhooks']
    expect(webhooksList?.get).toBeDefined()
    expect(webhooksList?.post).toBeDefined()

    const webhookDetail = spec.paths['/v1/webhooks/{id}']
    expect(webhookDetail?.get).toBeDefined()
    expect(webhookDetail?.patch).toBeDefined()
    expect(webhookDetail?.delete).toBeDefined()

    expect(spec.paths['/v1/webhooks/{id}/deliveries']?.get).toBeDefined()
    expect(spec.paths['/v1/webhooks/{id}/redeliver']?.post).toBeDefined()
  })

  it('contacts emits full CRUD (proves gating does not over-restrict)', () => {
    const contactsList = spec.paths['/v1/contacts']
    expect(contactsList?.get).toBeDefined()
    expect(contactsList?.post).toBeDefined()
    const contactsDetail = spec.paths['/v1/contacts/{id}']
    expect(contactsDetail?.get).toBeDefined()
    expect(contactsDetail?.patch).toBeDefined()
    expect(contactsDetail?.delete).toBeDefined()
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
