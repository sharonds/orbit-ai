import { describe, it, expect } from 'vitest'
import { ImportResource } from '../resources/imports.js'

describe('ImportResource', () => {
  const mockTransport = {
    request: async () => ({ data: {}, meta: {} }),
    rawRequest: async () => ({ data: {}, meta: {} }),
  } as any

  const resource = new ImportResource(mockTransport)

  it('exposes create, get, and list', () => {
    expect(typeof resource.create).toBe('function')
    expect(typeof resource.get).toBe('function')
    expect(typeof resource.list).toBe('function')
  })

  it('does not expose update, delete, search, or batch', () => {
    expect((resource as any).update).toBeUndefined()
    expect((resource as any).delete).toBeUndefined()
    expect((resource as any).search).toBeUndefined()
    expect((resource as any).batch).toBeUndefined()
  })

  it('response() only exposes create and get, not update/delete', () => {
    const resp = resource.response()
    expect(typeof resp.create).toBe('function')
    expect(typeof resp.get).toBe('function')
    expect((resp as any).update).toBeUndefined()
    expect((resp as any).delete).toBeUndefined()
    expect((resp as any).search).toBeUndefined()
    expect((resp as any).batch).toBeUndefined()
  })
})
