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

  it('documents schema migration and field confirmation DTOs', () => {
    expect(spec.paths['/v1/schema/migrations/preview']?.post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SchemaMigrationPreviewRequest',
    })
    expect(spec.paths['/v1/schema/migrations/apply']?.post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SchemaMigrationApplyRequest',
    })
    expect(spec.paths['/v1/schema/migrations/{id}/rollback']?.post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SchemaMigrationRollbackRequest',
    })
    expect(spec.paths['/v1/objects/{type}/fields/{fieldName}']?.patch.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SchemaMigrationUpdateFieldRequest',
    })
    expect(spec.paths['/v1/objects/{type}/fields/{fieldName}']?.delete.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SchemaMigrationDeleteFieldRequest',
    })

    const applyRequest = spec.components.schemas.SchemaMigrationApplyRequest
    expect(applyRequest.required).toEqual(expect.arrayContaining(['operations', 'checksum']))
    expect(applyRequest.properties.confirmation.$ref).toBe('#/components/schemas/DestructiveConfirmation')
    expect(applyRequest.additionalProperties).toBe(false)

    const previewResponse = spec.components.schemas.SchemaMigrationPreviewResponse
    expect(previewResponse.properties.confirmationInstructions.$ref).toBe('#/components/schemas/SchemaMigrationConfirmationInstructions')
    expect(previewResponse.properties.scope.$ref).toBe('#/components/schemas/SchemaMigrationTrustedScope')

    const applyResponse = spec.components.schemas.SchemaMigrationApplyResponse
    expect(applyResponse.required).toEqual(expect.arrayContaining(['rollbackable', 'rollbackDecision']))
    expect(applyResponse.properties.rollbackable).toEqual({ type: 'boolean' })
    expect(applyResponse.properties.rollbackDecision.$ref).toBe('#/components/schemas/DestructiveRollbackDecision')
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
    // After T6 the Envelope's `meta` is a $ref to EnvelopeMeta — assert
    // against the dedicated meta schema instead of an inlined object.
    const meta = spec.components.schemas.EnvelopeMeta
    expect(meta).toBeDefined()
    const metaProps = meta.properties
    expect(metaProps).toHaveProperty('request_id')
    expect(metaProps).toHaveProperty('version')
    expect(metaProps).toHaveProperty('has_more')
    expect(metaProps).toHaveProperty('next_cursor')
    expect(metaProps).not.toHaveProperty('org_id')
    expect(metaProps).not.toHaveProperty('api_version')

    // The Envelope itself should reference the shared meta schema.
    const envelope = spec.components.schemas.Envelope
    expect(envelope.properties.meta).toEqual({ $ref: '#/components/schemas/EnvelopeMeta' })
  })

  describe('T6 — response schemas reference shared envelope/error', () => {
    it('list responses use the paginated envelope and document standard auth errors', () => {
      const listOp = spec.paths['/v1/contacts']?.get
      expect(listOp?.responses?.['200']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/EnvelopePaginated',
      })
      // Standard auth error responses should reference the Error schema, not
      // be bare descriptions.
      expect(listOp?.responses?.['401']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Error',
      })
      expect(listOp?.responses?.['429']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Error',
      })
    })

    it('create responses use the envelope and document validation/conflict errors', () => {
      const createOp = spec.paths['/v1/contacts']?.post
      expect(createOp?.responses?.['201']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Envelope',
      })
      expect(createOp?.responses?.['400']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Error',
      })
      expect(createOp?.responses?.['409']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Error',
      })
    })

    it('get responses use the envelope and document the 404 path', () => {
      const getOp = spec.paths['/v1/contacts/{id}']?.get
      expect(getOp?.responses?.['200']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Envelope',
      })
      expect(getOp?.responses?.['404']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Error',
      })
    })

    it('dedicated import routes also reference the shared schemas', () => {
      const listImports = spec.paths['/v1/imports']?.get
      expect(listImports?.responses?.['200']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/EnvelopePaginated',
      })
      const createImport = spec.paths['/v1/imports']?.post
      expect(createImport?.responses?.['201']?.content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Envelope',
      })
    })

    it('the Error schema documents the full structured shape', () => {
      const errorSchema = spec.components.schemas.Error
      expect(errorSchema.required).toContain('error')
      const errorProps = errorSchema.properties.error.properties
      expect(errorProps).toHaveProperty('code')
      expect(errorProps).toHaveProperty('message')
      expect(errorProps).toHaveProperty('retryable')
      expect(errorProps).toHaveProperty('field')
      expect(errorSchema.properties.error.required).toEqual(
        expect.arrayContaining(['code', 'message', 'retryable']),
      )
    })

    it('exposes a separate EnvelopePaginated schema with array data', () => {
      const paginated = spec.components.schemas.EnvelopePaginated
      expect(paginated).toBeDefined()
      expect(paginated.properties.data.type).toBe('array')
    })

    it('generic entity delete responses match the runtime 200-envelope shape (Codex review)', () => {
      // Runtime: routes/entities.ts returns `c.json(toEnvelope(c, { id, deleted: true }))`
      // with Hono's default 200 status. The OpenAPI spec must document
      // the same shape so SDK codegen does not assume a 204 no-body.
      const deleteOp = spec.paths['/v1/contacts/{id}']?.delete
      expect(deleteOp).toBeDefined()
      expect(deleteOp.responses['204']).toBeUndefined()
      expect(deleteOp.responses['200']).toBeDefined()
      expect(deleteOp.responses['200'].content?.['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/Envelope',
      })
    })

    it('webhook delete also uses 200 envelope, not 204', () => {
      const deleteOp = spec.paths['/v1/webhooks/{id}']?.delete
      expect(deleteOp?.responses?.['204']).toBeUndefined()
      expect(deleteOp?.responses?.['200']).toBeDefined()
    })
  })
})
