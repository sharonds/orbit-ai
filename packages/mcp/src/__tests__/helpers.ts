import { vi } from 'vitest'
import type { OrbitClient } from '@orbit-ai/sdk'

export function makeMockClient(options?: { direct?: boolean }): OrbitClient {
  const resource = () => ({
    create: vi.fn(async (input) => ({ id: 'record_01', ...((input as object) ?? {}) })),
    get: vi.fn(async (id: string) => ({ id })),
    update: vi.fn(async (id: string, input) => ({ id, ...((input as object) ?? {}) })),
    delete: vi.fn(async (id: string) => ({ id, deleted: true })),
    search: vi.fn(async (body) => [{ id: 'record_01', body }]),
    batch: vi.fn(async (body) => ({ ok: true, body })),
    list: vi.fn(async (query) => ({ data: [{ id: 'record_01' }], meta: { has_more: false }, query })),
  })

  return {
    options: options?.direct ? { adapter: {} as never, context: { orgId: 'org_01' } } : { apiKey: 'orbit_test' },
    contacts: resource(),
    companies: resource(),
    deals: {
      ...resource(),
      move: vi.fn(async (id: string, input) => ({ id, ...input })),
      stats: vi.fn(async (query) => ({ query, total: 1 })),
    },
    pipelines: resource(),
    stages: resource(),
    activities: {
      ...resource(),
      log: vi.fn(async (input) => ({ id: 'activity_01', ...input })),
    },
    tasks: resource(),
    notes: resource(),
    products: resource(),
    payments: resource(),
    contracts: resource(),
    sequences: {
      ...resource(),
      enroll: vi.fn(async (id: string, body) => ({ id, ...body })),
    },
    sequenceSteps: resource(),
    sequenceEnrollments: {
      ...resource(),
      unenroll: vi.fn(async (id: string) => ({ id, status: 'exited' })),
    },
    sequenceEvents: {
      get: vi.fn(async (id: string) => ({ id })),
      list: vi.fn(async () => ({ data: [] })),
      pages: vi.fn(),
    },
    tags: {
      ...resource(),
      attach: vi.fn(async (id: string, body) => ({ id, ...body })),
      detach: vi.fn(async (id: string, body) => ({ id, ...body })),
    },
    schema: {
      listObjects: vi.fn(async () => [{ type: 'contacts', customFields: [] }]),
      describeObject: vi.fn(async (type: string) => ({ type, customFields: [] })),
      addField: vi.fn(async (type: string, body) => ({ type, ...body })),
      updateField: vi.fn(async (type: string, fieldName: string, body) => ({ type, fieldName, ...body })),
    },
    webhooks: resource(),
    imports: {
      create: vi.fn(async (input) => ({ id: 'import_01', ...((input as object) ?? {}) })),
      get: vi.fn(async (id: string) => ({ id })),
      list: vi.fn(async () => ({ data: [] })),
      pages: vi.fn(),
    },
    users: resource(),
    search: {
      query: vi.fn(async (input) => ({ data: [{ id: 'search_01' }], input })),
    },
  } as unknown as OrbitClient
}

export function parseTextResult(result: { content: Array<{ type: string; text?: string }> }) {
  const textBlock = result.content.find(
    (entry): entry is { type: 'text'; text: string } => entry.type === 'text' && typeof entry.text === 'string',
  )
  if (!textBlock?.text) {
    throw new Error('Expected text content block')
  }
  return JSON.parse(textBlock.text)
}

export function getTextContent(result: unknown) {
  if (result && typeof result === 'object' && 'content' in result) {
    const blocks = (result as { content: Array<{ type: string; text?: string }> }).content
    const block = blocks.find(
      (entry): entry is { type: 'text'; text: string } =>
        entry.type === 'text' && typeof entry.text === 'string',
    )
    if (!block) throw new Error('Expected text block')
    return block.text
  }

  const blocks = (result as { contents: Array<{ text?: string }> }).contents
  const block = blocks.find((entry): entry is { text: string } => typeof entry.text === 'string')
  if (!block) throw new Error('Expected resource text block')
  return block.text
}
